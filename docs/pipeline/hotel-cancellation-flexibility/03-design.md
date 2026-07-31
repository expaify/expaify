# UXDES-HOTEL-CANCELLATION-FLEXIBILITY-01 — Hotel cancellation flexibility clarity

**Stage:** UX Design · **Priority:** P0 · **Upstream:** `docs/pipeline/hotel-cancellation-flexibility/02-research.md`  
**Date:** 2026-07-31 · **Status:** implementation-ready contract and current-runtime absence repair

## 0. Design decision and release boundary

Expaify must not show a populated restricted-versus-flexible rate comparison in production with the current Hotellook or saved-deal contracts. Neither contract supplies two bookable rates or enough product, price-basis, freshness, and cancellation evidence to prove that two rates are like-for-like.

This specification has two deliberately separate deliverables:

1. **Shippable now — honest absence repair.** On hotel detail and provider handoff, state that cancellation choices are unavailable for the observed property price and direct the traveler to compare room rates and terms with the booking partner. Do not add an empty comparison to result cards.
2. **Research only — populated comparison contract.** Define and fixture-test the strict eligibility gate, two-rate selector, partial/conflicting states, handoff repetition, responsive behavior, copy, and analytics. Every populated example in this document must carry `Research fixture — not bookable` and must remain outside production routes until all release gates in §13 pass.

This is not approval for a hotel rate-shopping provider, a room browser, a flexibility filter, or a new production comparison feature.

## 1. User decision and hierarchy

The future comparison answers one question: **“For the same stay and room, what is the total extra cost of the provider-stated cancellation flexibility?”**

Information hierarchy is fixed:

1. **Primary:** total stay price and provider-stated cancellation outcome.
2. **Secondary:** total flexibility premium; absolute cancellation deadline; charge after the deadline.
3. **Tertiary:** the shared stay/room basis, taxes-and-fees basis, payment timing, provider source, and checked time.

The historical median and Deal Score remain a separate “current price versus normal price” concept. They must never appear inside the cancellation comparison or be used as either candidate rate.

## 2. Strict like-for-like comparison gate

### 2.1 Required normalized input

The gate is a pure function evaluated before any comparison UI renders. Both candidates must be returned through an approved `HotelProvider` adapter as `Result<T>` data. UI components must receive the evaluated outcome; they must not infer comparability.

Each candidate requires all of the following:

| Dimension | Required values | Equality rule |
|---|---|---|
| Supplier and property | `supplierKey`, stable `propertyId` | Exact equality; cross-provider comparison is forbidden. |
| Stay | ISO `checkIn`, ISO `checkOut`, positive integer `nightCount` | Exact equality after validating that dates and night count agree. |
| Occupancy | positive `roomCount`, non-negative `adultCount`, `childCount`, ordered child ages | Exact equality after child ages are sorted numerically. Missing ages are not equal to no children. |
| Room/product | stable `roomId`, normalized room name, bed configuration, capacity | IDs must match; normalized names and attributes must also agree. Matching marketing names alone never passes. |
| Inclusions | board/meal plan and complete set of price-bearing inclusions or credits | Exact equality of canonical codes as a set. Unknown is not equal to none. |
| Price | integer-minor-unit total-stay `Money`, price basis, tax/fee inclusion, payment timing | Same currency and basis; both totals must be positive safe integers. Nightly `priceFrom` is ineligible. |
| Freshness | live response/refresh ID, provider version, `fetchedAt`, expiry if supplied | Same response or refresh ID and version; neither may be expired. |
| Rate identity | stable `rateId` | Both present and distinct. |
| Cancellation | provider-supported outcome and evidence source | Both present, rate-scoped, and meaningfully different. The schedule is expected to differ. |
| Handoff | affiliate-safe selected-rate deeplink/token | Present for each rate and resolves to that exact rate; a property search link is ineligible. |

Conservative normalization may trim and collapse whitespace, case-fold provider-defined display names, sort canonical sets, and normalize ISO currency to uppercase. It may not translate marketing room names into an inferred room match, infer inclusions, convert currencies, infer taxes, compute a deadline from ambiguous prose, or reconcile providers.

### 2.2 Gate output and deterministic precedence

```ts
type CancellationComparisonEligibility =
  | { state: 'eligible'; pairId: string; restrictedRateId: string; flexibleRateId: string; premium: Money; policyCompleteness: 'complete' | 'partial_charge' }
  | { state: 'not_comparable'; failureReason: 'product_mismatch' | 'basis_mismatch' }
  | { state: 'insufficient_evidence'; failureReason: 'missing_identity' | 'missing_policy' | 'current_provider_unsupported' }
  | { state: 'stale_or_conflicting'; failureReason: 'stale' | 'conflicting' }
```

Evaluate in this order so the UI and analytics produce one stable result:

1. Adapter explicitly lacks live rate-shopping capability, or the source is a saved-deal/property observation → `insufficient_evidence/current_provider_unsupported`.
2. Contradictory rate, price-basis, or cancellation records → `stale_or_conflicting/conflicting`.
3. Different response versions, expired evidence, or failed freshness validation → `stale_or_conflicting/stale`.
4. Missing stable property/room/rate identity, occupancy, stay, or selected-rate handoff → `insufficient_evidence/missing_identity`.
5. Missing provider-supported cancellation outcome, source, or required deadline → `insufficient_evidence/missing_policy`.
6. Complete but unequal property, stay, occupancy, room, bed, capacity, inclusions, or supplier → `not_comparable/product_mismatch`.
7. Complete but unequal currency, total/nightly basis, tax/fee basis, or payment timing → `not_comparable/basis_mismatch`.
8. Same rate ID or materially identical cancellation outcomes → `not_comparable/product_mismatch`; there is no flexibility tradeoff.
9. Otherwise compute `premium.priceCents = flexibleTotal.priceCents - restrictedTotal.priceCents` in the shared currency. A negative premium is conflicting evidence, not a “saving.” Zero is allowed and renders `$0 more for cancellation flexibility`.

The flexible candidate must contain an explicit provider-supported free-cancellation outcome and an absolute deadline. The restricted candidate may be an explicit `Non-refundable` outcome without a deadline. A missing post-deadline charge may pass only as `policyCompleteness: 'partial_charge'`, because the provider-supported deadline still distinguishes the outcomes. Missing or ambiguous deadline, source, or outcome fails closed.

### 2.3 Production invariants

- Hotellook cached `priceFrom` always resolves to `insufficient_evidence/current_provider_unsupported`.
- A saved deal always resolves to `insufficient_evidence/current_provider_unsupported`.
- `medianPrice`, “usually” price, Deal Score baseline, two generic OTA links, or two rates from separate responses are never candidate pairs.
- No non-`eligible` outcome renders radios, “Same stay and room,” `Flexible option`, `Lower price`, a premium, or selected-rate handoff copy.
- Cancellation facts use the shared cancellation-policy taxonomy owned by `hotel-cancellation-clarity`; this feature does not create a second policy model.

## 3. Current-runtime absence repair — shippable now

### 3.1 Placement

| Surface | Required behavior |
|---|---|
| `/deals` result card (`DealCard`) | Render nothing about comparison eligibility. The user has no room-level decision here, and repeating the same absence on every card adds density. |
| Saved-deal detail | Place one disclosure after “Price and Deal Score” and before “Check rooms with provider.” Do not alter or relabel the observed nightly price. |
| Rich hotel detail / expanded `HotelCard` | Place the same disclosure in the expanded details before the provider review action. Do not add a collapsed-card flexibility badge. |
| Provider handoff / booking review | Repeat the disclosure immediately before the outbound Continue action. The generic provider link remains the only available path. |

### 3.2 Final copy

**Heading:** `Cancellation choices unavailable`  
**Body:** `Cancellation choices are not available for this observed price. Compare room rates and cancellation terms with the booking partner.`

The provider CTA keeps the surface’s existing label. Do not add a second CTA inside the disclosure. The statement is static evidence, so it has no `role="alert"`, `role="status"`, or live region.

### 3.3 Visual specification

Use a compact warning-toned evidence panel, not an error banner and not a favorable badge.

```txt
min-w-0 rounded-[var(--radius-control)]
border border-[color:var(--border-strong)]
bg-[color:var(--warning-soft)] p-4

heading: font-display text-small font-bold leading-5 text-[color:var(--text-1)]
body: mt-1 break-words text-small leading-5 text-[color:var(--text-2)]
```

At 375px it is full width in the parent column. At 1280px it remains within the existing content column; do not cap it below the width of the adjacent provider action. No icon is required. Meaning must not depend on color.

## 4. Research-fixture eligible comparison — not production-shippable

Every fixture surface starts with a visible pill: **`Research fixture — not bookable`**. Use a generic source label, **`Research provider`**. Never display a real provider brand or emit fixture deeplinks.

### 4.1 Shared comparison anatomy

1. `<fieldset>` with legend **`Choose a cancellation option`**.
2. Supporting line: **`These rates are for the same stay, room, occupancy, inclusions, price basis, and booking partner.`**
3. Collapsible shared basis, summary **`Same stay and room`**, followed by the complete common facts. It is expanded by default in research so participants can verify the match.
4. Two complete radio-card labels. Never use policy columns detached from their prices.
5. Premium line between/after the cards: **`{Money} more for cancellation flexibility`**.
6. Disabled or enabled continuation action under the group.

### 4.2 Eligible fixture A — exact visible copy

Shared basis:

- `Fri, 14 Aug–Mon, 17 Aug 2026 · 3 nights`
- `2 adults · 1 room`
- `Deluxe Queen · 1 queen bed · Room only`
- `Total includes taxes and fees · Pay now`

Restricted option:

- Eyebrow: `Lower total`
- Price: `$420 total`
- Outcome: `Non-refundable`
- Consequence: `Research provider reports a $420 cancellation charge.`
- Source: `Research provider · Checked 31 Jul 2026, 14:30 GMT`

Flexible option:

- Eyebrow: `Cancellation flexibility`
- Price: `$468 total`
- Outcome: `Free cancellation until Fri, 14 Aug 2026`
- Consequence: `After the deadline, Research provider reports a $468 cancellation charge.`
- Source: `Research provider · Checked 31 Jul 2026, 14:30 GMT`

Premium: **`$48 more for cancellation flexibility`**

No option is preselected. Before selection, the action label is **`Select an option to continue`** and is disabled. After selection it becomes **`Continue with $420 total`** or **`Continue with $468 total`**.

### 4.3 Radio-card patterns

```txt
group: mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2
label default: min-w-0 cursor-pointer rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4
label hover: hover:border-[color:var(--border-hover)]
label selected: border-[color:var(--brand)] bg-[color:var(--success-soft)]
label focus-within: focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--border-focus)]
price: font-display text-h2 tabular-nums text-[color:var(--text-1)]
outcome: mt-3 break-words text-body font-medium text-[color:var(--text-1)]
consequence: mt-1 break-words text-small text-[color:var(--text-2)]
source: mt-3 break-words text-caption text-[color:var(--text-3)]
```

The native radio remains visible and has a minimum 44×44px combined label hit area. Selected state uses border, fill, radio state, and text; color alone is never the indicator. `aria-describedby` connects each radio to its price, outcome, consequence, and source. The fieldset legend supplies the group name.

## 5. Partial, non-comparable, stale, and conflicting behavior

### 5.1 Partial charge fixture C

If the flexible outcome and absolute deadline are provider-supported but the post-deadline charge is absent, the pair may render only as an explicitly partial research fixture.

- Outcome: `Free cancellation until Fri, 14 Aug 2026`
- Consequence heading: `Cancellation charge not provided`
- Consequence body: `Research provider did not state what you would pay after the deadline. Confirm before booking.`
- Premium remains visible because identity and price bases match and the deadline establishes a distinct cancellation choice.
- Add warning styling to the missing-charge block: `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]`.
- Do not use `Fully refundable`, calculate a refund, or imply anything about cancellations after the deadline.

If the deadline itself is missing, show no pair and resolve to `insufficient_evidence/missing_policy`. The approved field copy in policy detail is `Cancellation deadline not provided`, but the comparison surface renders the single absence state rather than two incomplete rows.

### 5.2 Complete but not comparable fixture B

When complete rates differ on room, bed, occupancy, inclusion, stay, or supplier:

- Heading: `These rates are not like-for-like`
- Body: `Room details or inclusions differ, so the price difference cannot be attributed to cancellation flexibility.`
- Supporting instruction: `Compare each rate's room details, total price, and cancellation terms separately.`

When only price basis differs:

- Heading: `These totals cannot be compared`
- Body: `Taxes, fees, currency, or payment timing differ between these rates.`
- Supporting instruction: `Compare complete totals with the booking partner.`

No premium, radio, selected state, or continuation from a selected rate renders. In a research prototype, a single **`Back to room options`** button returns focus to the rate-list heading.

### 5.3 Stale evidence

- Heading: `Cancellation choices need a refresh`
- Body: `These rates were not checked together or are no longer current.`
- Primary action: `Refresh rates`
- Secondary action: `Compare with booking partner`

While refreshing, the primary action reads `Refreshing rates…`, is disabled, and sets `aria-busy="true"` on the comparison region. Never leave the old premium visible during refresh.

### 5.4 Conflicting evidence

- Heading: `Cancellation terms conflict`
- Body: `The provider returned conflicting cancellation details, so expaify cannot compare these rates.`
- Action: `Compare with booking partner`

Use `border-[color:var(--error)] bg-[color:var(--error-soft)]`; copy uses `text-[color:var(--error-text)]`, never `--error` as text. This state is not retryable unless a new provider refresh is available. No favorable cancellation phrase from either conflicting record may remain visible.

### 5.5 Unsupported and insufficient evidence

Current provider unsupported uses §3 copy. Other missing identity or policy evidence uses:

- Heading: `Cancellation choices unavailable`
- Body: `There is not enough room, rate, price, or cancellation evidence to compare these options safely.`
- Supporting instruction: `Compare room rates and cancellation terms with the booking partner.`

Do not enumerate empty fields in production UI.

## 6. Loading, empty, error, and refresh states

| State | Presentation | Interaction and announcement |
|---|---|---|
| Initial loading | Heading `Checking cancellation choices…`; three non-text skeleton lines in a single neutral panel. No two-card skeleton, because eligibility is not known. | Comparison region has `role="status"`, `aria-live="polite"`, `aria-busy="true"`, and accessible text `Checking whether these hotel rates can be compared.` No CTA or stale selection. |
| No rates / page empty | Use the parent hotel-search empty state. Do not mount a cancellation comparison or emit an evaluation event without an offer context. | Parent recovery action owns focus and retry. |
| One valid rate only | `insufficient_evidence/missing_identity`; use the generic unavailable copy in §5.5. | Static state; no live region. |
| Unsupported current provider | `insufficient_evidence/current_provider_unsupported`; use exact §3 copy. | Static state; provider handoff remains available outside the panel. |
| Provider/network error | Heading `We couldn’t check cancellation choices`; body `Try again, or compare cancellation terms with the booking partner.` | `role="status"`, `aria-live="polite"`. Actions: `Try again` and `Compare with booking partner`. Retry retains focus until completion. |
| Refreshing stale data | Replace old comparison with one neutral loading panel. | `aria-busy="true"`; disable retry and selected-rate continuation. On success focus the comparison legend; on failure focus the error heading with `tabIndex={-1}`. |
| Eligible, no selection | Two radio cards; no preselection. | Disabled `Select an option to continue`. Do not announce disabled state on mount. |
| Eligible, selected | Selected radio card and enabled total-specific CTA. | Polite status: `{Outcome} selected. {Total} total.` Do not repeat the entire policy. |

The synchronous gate itself has no artificial loading state. Loading is used only while acquiring or refreshing provider data.

State containers use these tokenized Tailwind patterns:

| State | Container pattern | Copy/action pattern |
|---|---|---|
| Default eligible | `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 sm:p-6` | Heading `text-h3 text-[color:var(--text-1)]`; support `text-small text-[color:var(--text-2)]`; continue uses existing `btn btn-primary`. |
| Loading / refreshing | `rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4` | Heading `text-small font-medium text-[color:var(--text-1)]`; skeletons use existing `skeleton`; disabled action uses existing `.btn:disabled`. |
| Empty / insufficient / unsupported | `rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4` | Heading `text-small font-bold text-[color:var(--text-1)]`; body `text-small text-[color:var(--text-2)]`. |
| Not comparable | `rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] p-4` | Heading `text-small font-bold text-[color:var(--text-1)]`; body `text-small text-[color:var(--text-2)]`; recovery uses `btn btn-outline`. |
| Error / conflicting | `rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4` | Heading `text-small font-bold text-[color:var(--error-text)]`; body `text-small text-[color:var(--text-2)]`; retry uses `btn btn-outline`. |
| Partial charge | Eligible container plus a nested `rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3` | Missing-field heading `text-small font-bold text-[color:var(--warning)]`; explanation `text-small text-[color:var(--text-2)]`. |

Every container also uses `min-w-0`; every dynamic/provider string uses `break-words [overflow-wrap:anywhere]`. Do not introduce new colors, radii, shadows, or text sizes.

## 7. Selection, keyboard, focus, and handoff rules

### Pointer and touch

- Tapping anywhere within a radio card selects it.
- Tapping shared-basis summary toggles only that disclosure and never changes selection.
- Changing selection updates the CTA and selected summary without scrolling.
- Continue is allowed only when the selected `rateId`, `pairId`, evidence version, price, policy, and selected-rate affiliate deeplink still match. Otherwise transition to stale/conflicting and suppress continuation.

### Keyboard

- `Tab` enters the radio group at the first unchecked option; after a choice it enters at the checked option.
- Arrow keys move and select according to native radio-group behavior.
- `Space` selects the focused radio. `Enter` on a focused radio also selects it without submitting or navigating; `Enter` on the enabled Continue action proceeds.
- `Shift+Tab` follows DOM order. Visual order and DOM order are restricted then flexible on every breakpoint.
- `Escape` has no effect because the comparison is not a modal.
- The shared-basis disclosure uses native `<details>/<summary>` keyboard behavior.

### Focus

- Use the global 3px `--focus-outline` and `--focus-ring`; never remove the outline.
- After successful refresh, move programmatic focus only when the refresh was user initiated. Focus the legend or comparison heading with `tabIndex={-1}`.
- On gate failure after selection, focus the new state heading and announce the reason once.
- Provider navigation preserves existing outbound behavior; no new tab is forced by this component.

### Handoff repetition for an eligible fixture

Immediately before the outbound action show:

- Heading: `Selected cancellation option`
- `$468 total`
- `Free cancellation until Fri, 14 Aug 2026`
- `After the deadline, Research provider reports a $468 cancellation charge.`
- `Research provider · Checked 31 Jul 2026, 14:30 GMT`
- CTA: `Continue to booking partner`

If any displayed value differs from the selected rate record, render `Cancellation choices need a refresh` and prevent continuation. Current production handoff shows only the §3 absence repair, never this populated summary.

## 8. Responsive specification

### Mobile — 375px viewport

- Parent horizontal padding: existing `px-4`; comparison uses `w-full min-w-0`.
- Stack shared basis, both complete radio cards, premium line, and CTA in one column.
- Use `gap-3`, panel `p-4`, and at least 44px for summary, radio labels, and actions.
- Prices and policy strings use `break-words`; provider strings additionally use `[overflow-wrap:anywhere]`.
- Never truncate, line-clamp, horizontally scroll, or place price in one column and policy in another.
- The CTA is `w-full`. The premium line may wrap to two lines and stays centered only if both lines remain readable; otherwise left-align.
- Test at 320px minimum as an edge case even though acceptance screenshots are 375px.

### Desktop — 1280px viewport

- Use the existing detail container; do not exceed `max-w-[1080px]`.
- The two eligible radio cards may use `lg:grid-cols-2`; both stretch to equal height.
- Shared basis spans both columns. Premium sits below the pair, not overlaid between columns.
- CTA aligns to the end and is at least 44px high; it need not span full width.
- Non-eligible and error panels stay single-column to avoid resembling an empty comparison table.

## 9. Copy system

| Purpose | Approved copy | Forbidden copy |
|---|---|---|
| Current absence | `Cancellation choices are not available for this observed price.` | `No cancellation restrictions`, `Flexible options unavailable`, `No policies reported` |
| Flexible outcome | `Free cancellation until {absolute date}` | `Refundable`, `Flexible rate`, `Free cancellation` without a date/source |
| Restricted outcome | `Non-refundable` | `Final sale`, `No cancellations` |
| Partial outcome | `Partially refundable` only when provider-supported, followed by the exact schedule | A favorable badge without the schedule |
| Deadline absent | `Cancellation deadline not provided` | An inferred date or relative countdown |
| Charge absent | `Cancellation charge not provided` | `$0`, `No charge`, or an inferred refund |
| Conflict | `Cancellation terms conflict — compare with the booking partner` | Choosing the more favorable record |
| Premium | `{Money} more for cancellation flexibility` | Percentage-only premiums, savings language, or premium computed from historical median |
| Source | `{Provider} · Checked {absolute date and time zone}` | Unattributed policy copy or relative freshness only |

Dates use `EEE, d MMM yyyy` in the user’s locale where supported, always including the year and never only “today,” “tomorrow,” or “in N days.” Provider relative wording may be shown verbatim only in the full policy detail owned by cancellation clarity; it is insufficient for this comparison gate.

## 10. Edge cases and fail-closed rules

- More than two rates: evaluate candidate pairs, but render at most one pair selected by deterministic product logic outside the UI. Never create a comparison matrix. If more than one pair is equally valid, require the user to choose a room first.
- Same total price: render `$0 more for cancellation flexibility`; do not call it “free flexibility.”
- Flexible total lower than restricted total: classify `conflicting`; do not show a negative premium or “save.”
- Very large premium: use localized `Money` with integer minor units and natural wrapping. Analytics uses only the bounded bucket.
- Currency mismatch or unsupported currency: `not_comparable/basis_mismatch`; never convert currency in the UI.
- Tax/fee basis, payment timing, or inclusion unknown: fail as missing evidence; unknown never equals unknown.
- One rate expires after selection: clear selection and render stale state.
- Provider policy changes before handoff: clear selection and require refresh.
- Duplicate `rateId` or property-level deeplink: fail as missing identity.
- Mixed locale/time zone: show the absolute deadline in property local time when explicitly supplied; include the named time zone. If the applicable time zone is missing, fail `missing_policy`.
- Long translated/provider text: wrap; never truncate. Raw provider prose stays in the cancellation-policy detail, not analytics.
- JavaScript or analytics failure: comparison and handoff continue to function; analytics never blocks selection or navigation.

## 11. Analytics contract

All events must be registered in both server-side allowlist maps before client emission. Values are enums or bounded buckets. Never send hotel names, dates, raw provider policy prose, prices, room names, occupancy ages, URLs, or other free text.

### 11.1 Events, triggers, and required properties

| Event | Trigger and dedupe | Required properties |
|---|---|---|
| `hotel_cancellation_comparison_evaluated` | Once per offer/pair evidence version per surface when the pure gate resolves, including current unsupported. It does not require viewport exposure. | `surface`, `eligibility_state`, `failure_reason`, `provider`, `viewport_group` |
| `hotel_cancellation_comparison_viewed` | Eligible research/approved comparison only, after at least 50% of the component is visible continuously for 1 second; once per pair/version/surface/session. Never emit for unsupported or non-comparable states. | `surface`, `provider`, `premium_bucket`, `restricted_policy_state`, `flexible_policy_state`, `viewport_group` |
| `hotel_cancellation_rate_selected` | On explicit radio selection. First selection uses `selection_changed=false`; later changes use `true`. | `surface`, `provider`, `selected_policy_state`, `premium_bucket`, `selection_changed` |
| `hotel_cancellation_handoff_continued` | Immediately before navigating with a still-valid selected rate. | `provider`, `selected_policy_state`, `premium_bucket`, `policy_details_seen` |
| `hotel_cancellation_clarification_opened` | When the traveler opens shared basis, policy detail, or missing/conflict help. Do not emit for a disclosure expanded by default until the user toggles it. | `surface`, `provider`, `missing_fact`, `eligibility_state` |

Allowed enum values:

```txt
surface = hotel_detail | saved_deal_detail | hotel_handoff | research_prototype
eligibility_state = eligible | not_comparable | insufficient_evidence | stale_or_conflicting
failure_reason = none | product_mismatch | basis_mismatch | missing_identity | missing_policy | stale | conflicting | current_provider_unsupported
viewport_group = mobile | desktop
premium_bucket = 0 | 1_25 | 26_50 | 51_100 | 101_plus
restricted_policy_state = non_refundable | partially_refundable
flexible_policy_state = free_until | partially_refundable | partial_charge_missing
selected_policy_state = non_refundable | free_until | partially_refundable | partial_charge_missing
missing_fact = none | shared_basis | deadline | cancellation_charge | policy_conflict
```

`premium_bucket` uses the displayed total premium’s major-unit magnitude only after confirming the same currency and basis. It is for aggregation, not display. `provider` must be a bounded adapter key such as `hotellook` or `research_fixture`, never a display string. `viewport_group` is `mobile` below 768px and `desktop` otherwise.

Current Hotellook and saved-deal behavior emits only:

```txt
hotel_cancellation_comparison_evaluated
eligibility_state=insufficient_evidence
failure_reason=current_provider_unsupported
```

It must never emit `comparison_viewed`, `rate_selected`, or `handoff_continued` for a populated cancellation option.

Analytics delivery is best-effort inside the existing safe tracking wrapper. Route validation rejects unknown properties, raw policy text, and out-of-enum values. Join to the existing handoff-return funnel only through an already permitted opaque, non-PII context; never label every return as cancellation-driven.

## 12. Acceptance criteria

### Current-runtime repair

- Every Hotellook and saved-deal offer resolves to `insufficient_evidence/current_provider_unsupported`.
- Saved-deal detail and handoff show the exact honest-absence body before provider continuation.
- Result cards show no empty selector, flexibility badge, or repeated absence block.
- The observed price and historical median retain their existing labels and are never compared as rate choices.
- Static absence copy is readable at 375px and 1280px, has no truncation or overlap, and does not use a live region.

### Research-fixture contract

- Fixture A shows `$420` versus `$468`, `$48 more for cancellation flexibility`, the absolute deadline, and the provider-stated consequence.
- Fixture B suppresses the premium and selection because room/inclusions differ.
- Fixture C shows the deadline and `Cancellation charge not provided` without claiming full refundability.
- Conflicting and stale inputs suppress all populated comparison claims.
- Native single-select semantics, keyboard order, visible focus, 44px targets, and selected-rate handoff repetition all pass.
- At 375px complete rate rows stack; at 1280px they may form two equal-height columns.
- Analytics allowlist and route tests enforce the contract and current unsupported offers never emit a comparison view.

## 13. Dependencies and release gates

A populated production comparison remains blocked until all are true:

1. Product explicitly approves a live hotel rate-shopping feature.
2. An approved provider behind `lib/providers` returns multiple bookable rate products, stable room/rate IDs, complete like-for-like fields, structured cancellation evidence, total-stay integer `Money`, and affiliate-safe selected-rate deeplinks.
3. The shared cancellation-policy model and lexicon from `hotel-cancellation-clarity` are implemented; no duplicate policy taxonomy exists.
4. The three-scenario prototype is tested with 8–12 first-time hotel bookers on mobile and desktop and meets every research threshold: at least 80% correct in each scenario, zero missing-data-as-free-cancellation interpretations, and no viewport gap above 15 percentage points.
5. Server analytics validation, provider-contract tests, gate unit tests, component state tests, and selected-rate handoff integrity tests pass.

Until then, the only production UI authorized by this spec is the current-runtime absence repair in §3.

## 14. UI-stage handoff scope

The next UI ticket should implement only the docs/UI portion that is safe with current contracts:

- the reusable current-runtime absence panel;
- placement on saved-deal detail, expanded hotel detail, and provider handoff before continuation;
- responsive, wrapping, and accessibility behavior from §3 and §8; and
- fixture-only component stories/tests for the eligible, partial, not-comparable, stale, conflicting, loading, and error states if the repository has an established non-production research-fixture surface.

It must not change provider/API/business contracts, expose populated comparisons on production routes, compute a premium from existing fields, or add analytics events. Gate logic, provider contracts, selected-rate handoff integrity, and server analytics registration require a later explicitly scoped DEV ticket after the provider and feature gates are approved.
