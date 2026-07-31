# UXDES-HOTEL-DEPOSIT-HOLD-01 — Hotel Deposit and Incidental-Hold Comparison Clarity

**Stage:** UX Design · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-deposit-hold`  
**Upstream:** `docs/pipeline/hotel-deposit-hold/02-research.md`  
**Downstream:** `UI-HOTEL-DEPOSIT-HOLD-01`

## Decision

Deposit and incidental-hold information appears in the result list only when it helps a traveler compare
hotels.

- If every visible bookable result comes from a provider that cannot return this information, show one
  neutral limitation statement for the set and no repeated card warnings.
- If at least one visible bookable result comes from a capable provider, show one legend for the set.
  Show a card signal only for valid `complete`, `partial`, `conflicting`, or `explicit_none` evidence.
- Never show a card signal for `not_returned`, unsupported, malformed, loading, or error. Those states are
  explained once at set level and remain fully disclosed for the selected hotel in detail and handoff.
- An absent label always means unknown, never no deposit.

This changes comparison-tier placement only. The full evidence and terminology contract in
`docs/pipeline/hotel-deposit-holds/03-design.md` remains authoritative unless this spec explicitly
supersedes it.

## Actual production owner and integration boundary

The production result-set owner is the `<section aria-labelledby="hotel-results-heading">` in
`app/deals/DealFeed.tsx`. It owns result status, loading, errors, empty states, filtering, sorting,
pagination, the result grid, and the append boundary. Its card renderer is
`app/components/ui/DealCard.tsx`.

`app/components/HotelCard.tsx` is not imported by the production `DealFeed`. Adding an aggregate message
only around `HotelCard`, or changing only `HotelFundsPolicyPanel`, does not repair the live result list.
The production placement must therefore be:

```text
DealFeed result section
├── HotelResultStatus / result count
├── DepositHoldSetDisclosure (one instance at most)
├── result grid
│   └── DealCard
│       └── DepositHoldCardSignal (only for returned qualifying evidence)
└── ResultCoverageBoundary / load-more control
```

The current `ApiDeal`, `DealsResponse`, and `DealCardDeal` contracts carry no provider, funds-policy
evidence, capability, or policy load state. The UI stage may build the presentation and fixtures, but a
DEV stage must carry normalized provider evidence and capability into the live response before the live
surface can make truthful decisions. Do not infer capability from OTA links, provider name, or an empty
field. Until the normalized bridge exists, the production feed must render no new claim.

## Scope

### In scope

- Provider capability semantics for deposit/hold policy.
- One set-level treatment owned by `DealFeed`.
- Conditional compact signals owned by `DealCard`.
- All-unsupported, mixed, all-capable, loading, capability-error, empty, filter/sort refresh, and
  pagination states.
- Retention and semantic distinction of full evidence in hotel detail and booking handoff.
- Exact copy, responsive behavior at 375px and 1280px, keyboard/focus behavior, analytics, and test
  fixtures.

### Out of scope

- Selecting, procuring, or scraping a new hotel provider.
- Rate-payment timing, cancellation, taxes, mandatory fees, stay-total calculation, ranking, or Deal
  Score changes.
- Estimating a deposit from hotel class, geography, price, chain, or common practice.
- Adding deposits or holds to price or treating a hold as money charged.
- Replacing the existing result feed with `HotelCard`.

## Data and capability contract

Add a provider-neutral declaration alongside the evidence on every normalized hotel offer:

```ts
export interface HotelFundsPolicyCapability {
  /** True only when the adapter contract can return deposit/hold policy evidence. */
  policy: boolean
}

interface HotelOffer {
  // existing fields
  fundsPolicy: HotelFundsPolicyEvidence
  fundsPolicyCapability?: HotelFundsPolicyCapability
}
```

For the live deal-feed bridge, each unlocked, bookable `ApiDeal` must receive the same normalized fields
without flattening the evidence into prose:

```ts
type ApiDealFundsPolicy = {
  provider: string
  capability: HotelFundsPolicyCapability
  evidence: HotelFundsPolicyEvidence
  loadState: HotelFundsPolicyLoadState
}
```

The final field name can follow repository conventions, but its semantics may not change.

### Semantic rules

1. `policy: false` means the adapter contract cannot return deposit/hold evidence. It says nothing about
   the property's actual policy.
2. `policy: true` means the adapter can return evidence. It does not promise that a specific offer has
   evidence.
3. Missing, invalid, or legacy capability normalizes to `false`; it must not become supported.
4. `policy: false` paired with `complete`, `partial`, `conflicting`, or `explicit_none` is malformed.
   Degrade the pair to unsupported for comparison and log bounded diagnostic telemetry. Never display
   the contradictory evidence as confirmed.
5. `policy: true` plus `not_returned` is a valid capable-but-unknown offer. It receives no card signal.
6. `explicit_none` is valid only under the validation rules in the prior design: it must explicitly
   cover both deposit and incidental hold for a valid scope and source.
7. Capability is produced in `lib/providers`, survives cache replay, deduplication, selected-hotel
   context, detail, and handoff, and is never generated by a component.
8. Hotellook's two offer-construction paths declare `{ policy: false }` until its contract can actually
   return this evidence.
9. Money remains `{ priceCents: number; currency: string }`. A percentage stays a percentage; a range
   stays a range; multiple obligations are never summed.

## Aggregation model

Compute the set state from all normalized, unlocked, bookable offers currently rendered in the result
grid after deduplication. Locked cards, sample cards, skeletons, stale/inert prior results, and failed
append placeholders do not enter the calculation.

```ts
type HotelFundsSetCapability = 'none' | 'mixed' | 'all'

supportedCount = visibleOffers.filter(validCapability.policy).length

none  = visibleCount > 0 && supportedCount === 0
all   = visibleCount > 0 && supportedCount === visibleCount
mixed = visibleCount > 0 && supportedCount > 0 && supportedCount < visibleCount
```

Evidence counts are calculated only after validating the capability/evidence pair. The disclosure is
rendered once, outside the grid, after the settled result status and before the first result card.

## Information hierarchy

### Result set

1. **Primary:** whether deposit/hold evidence is available anywhere in this result set.
2. **Secondary:** how to interpret an unlabeled result.
3. **Tertiary:** that additional available funds may still be required and should be confirmed before
   booking.

### Result card

1. **Primary:** returned mechanism and amount/rule when complete.
2. **Secondary:** evidence quality when incomplete or conflicting, or the provider's explicit-none
   statement.
3. **Tertiary:** full provenance, scope, freshness, missing fields, conflicts, and confirmation path in
   detail/handoff—not on the card.

Price, Deal Score, and hotel identity keep their existing primacy. Deposit/hold is never presented as a
price component, discount, fee, or score input.

## Set-level states and final copy

### 1. All unsupported (`none`)

Render one neutral named `<aside>` after `HotelResultStatus` and before the grid.

- Heading: **`Deposit and hold details unavailable`**
- Body: **`The providers in these results do not supply deposit or incidental-hold details. A property may still require additional available funds. Confirm before booking.`**

Render zero card-level policy rows, including on all later pages. Do not use `role="alert"`, `role="status"`,
amber, red, a warning icon, or a control. The aside is encountered in normal reading order and creates no
tab stop.

### 2. Mixed capability (`mixed`)

Render one neutral legend:

- Heading: **`About deposit and hold details`**
- Body: **`Deposit and hold details are shown only when a provider returns them. No label means the policy is unknown, not that no deposit applies.`**

Card rules apply only to valid qualifying returned evidence. Unsupported and supported/`not_returned`
cards are both unlabeled.

### 3. All capable (`all`)

Use the same legend and copy as `mixed`. Capability does not guarantee offer-level evidence, so the
unlabeled-result explanation remains required even if the current page happens to have evidence for every
offer. This prevents the meaning of label absence from changing after filtering or pagination.

### 4. Initial result loading

While the result grid itself has no settled bookable offers, do not render a separate deposit disclosure.
The existing result-loading copy and skeletons are sufficient; capability cannot yet be truthfully
aggregated. Skeleton cards contain no policy-row skeleton.

### 5. Capability refresh while settled results remain visible

During a filter, criteria, or sort refresh, the prior cards are `inert` and `aria-hidden`. Remove their
set disclosure with them and render one status above the active result skeletons:

- Visible copy: **`Checking whether deposit and hold details are available…`**

Use `role="status" aria-live="polite" aria-atomic="true" aria-busy="true"`. Do not repeat this message
per skeleton. When the new results settle, replace it with the applicable `none`, `mixed`, or `all`
treatment. The existing results announcement remains the primary result-count announcement; avoid
concatenating the full policy explanation into it.

### 6. Capability check error with usable results

If results load but their normalized capability/evidence bridge fails independently, show one neutral
status and no card signals:

- Heading: **`Deposit and hold details couldn't be checked`**
- Body: **`We couldn't check whether these providers supply deposit and hold details. A property may still require additional available funds. Confirm before booking.`**

Use `role="status" aria-live="polite"`, not an assertive alert. Keep cards and their actions usable. Show
`Retry deposit and hold check` only when an isolated retry exists; otherwise show no action. A retry
affects policy data only and cannot refetch or change price.

Retry labels:

- Idle: **`Retry deposit and hold check`**
- Pending: **`Checking details…`**

### 7. Whole-result request error

Keep the existing `DealFeed` result error unchanged. Do not add a deposit/hold error because there are no
usable results to describe.

### 8. Empty results

Render no deposit disclosure, legend, policy row, or policy-specific analytics. There is no selectable
stay and no provider set to describe. Existing empty-state actions remain unchanged.

### 9. Locked and sample-only sets

If no unlocked, bookable result is visible, render no deposit disclosure. Do not disclose policy claims
for obfuscated locked cards or sample hotels.

## Card-level signal rules and final copy

`DealCard` renders at most one compact, non-interactive paragraph between the existing price/checked
content and `PropertyPhoto`. It is part of the enclosing card link where applicable and adds no nested
control or tab stop. It must wrap fully and must not use `truncate`, `line-clamp-*`, or
`whitespace-nowrap`.

| Valid evidence | Show on card | Exact copy |
|---|---|---|
| `complete`, one hold | Yes | `Temporary card hold: {amountAndBasis}. Not part of the stay price.` |
| `complete`, one deposit | Yes | `Refundable deposit: {amountAndBasis}. Collected separately from the stay price.` |
| `complete`, one other refundable amount | Yes | `Other refundable amount: {amountAndBasis}. Separate from the stay price.` |
| `complete`, two obligations | Yes | `Additional funds reported: {firstMechanism} {firstAmountAndBasis}; {secondMechanism} {secondAmountAndBasis}.` |
| `complete`, three or more | Yes | `Additional funds reported: {count} separate refundable deposit or hold requirements. Review details before booking.` |
| `partial` | Yes | `Deposit or hold details are incomplete. Confirm the missing information before booking.` |
| `conflicting` | Yes | `Deposit or hold details conflict. Confirm the amount and timing before booking.` |
| `explicit_none` | Yes | `The provider reports no deposit or incidental hold for {scopePhrase}.` |
| `not_returned` | No | No card copy. |
| unsupported | No | No card copy. |
| malformed capability/evidence pair | No | No card copy. |
| loading or error | No | No card copy; aggregate once at set level. |

Amount, basis, scope, multiple-obligation, variable, range, percentage, and currency formatting use the
exact formatter rules in `docs/pipeline/hotel-deposit-holds/03-design.md`. Do not shorten or strengthen
those claims. `explicit_none` uses the prior scope phrases (`this property`, `this room`, `this rate`,
`this selected stay`) and is visually neutral, not a green success state.

The card's existing accessible name (`View deal: {hotelName}`) is not expanded with the entire policy.
Because the signal is already in the linked card's accessible content, do not duplicate it into
`aria-label`. If the implementation's explicit `aria-label` suppresses descendant text for the target
screen-reader/browser combination, update it to:

**`View deal: {hotelName}. {cardSignalCopy}`**

Do this only when a card signal is visible. Unlabeled cards keep **`View deal: {hotelName}`**; never append
unknown or unsupported state per card.

## Full detail and handoff retention

Full evidence remains mandatory for the selected hotel even when its comparison card had no label. Reuse
`HotelFundsPolicyPanel variant="full"` and preserve obligations, source, scope, freshness, missing fields,
conflicts, confirmation guidance, and affiliate-marked handoff URL.

### Provider incapable

Capability `policy: false` changes the full-panel treatment from warning to neutral.

- Panel heading remains: **`Additional funds at the property`**
- State heading: **`Deposit and hold details unavailable from this provider`**
- Body: **`This provider does not supply deposit or incidental-hold details. The property may still require additional available funds.`**
- Guidance: **`Confirm whether this property requires additional available funds before booking.`**
- Source: **`Source checked: {sourceLabel} · Scope not provided`**

Use neutral surface and border tokens. Never say `No deposit`, `No hold`, or imply the provider checked the
property and found none.

### Capable provider, offer evidence not returned

- Panel heading remains: **`Additional funds at the property`**
- State heading: **`Policy not provided for this offer`**
- Body: **`The provider can supply deposit or incidental-hold details, but did not return a policy for this offer.`**
- Guidance: **`Confirm whether this property requires additional available funds before booking.`**
- Source: **`Source checked: {sourceLabel} · Scope not provided`**

Use the existing caution treatment for offer-level unknown. This is distinct from provider incapability.

### Returned evidence and operational states

`complete`, `partial`, `conflicting`, `explicit_none`, loading, and error retain the full state content,
interaction, and confirmation rules from the prior design. The comparison repair must not remove detail,
weaken attribution, collapse conflicts, or remove the handoff confirmation path.

At booking handoff, the full panel remains immediately before the provider action. A valid safe link uses
the existing affiliate-marked URL and `rel="noopener noreferrer sponsored"`. Capability and evidence do
not disable `View deal`, detail navigation, or `Continue to {partner}`.

## Placement and interaction behavior

### Initial load, filter, and sort

- Result status settles first, followed by the one set disclosure, followed by the grid.
- Filtering and sorting recompute from the new normalized visible set; never retain a stale disclosure.
- Do not move focus to the disclosure on ordinary successful updates. Preserve current `DealFeed` focus
  recovery behavior and let the existing result status announce the update.
- If a user explicitly activates an isolated policy retry, keep focus on the retry control while it
  exists. On completion, move focus to the new disclosure heading only if the retry replaces the control;
  the heading may receive `tabIndex={-1}` for this programmatic focus only.

### Pagination / load more

- During append, keep the settled disclosure for already visible offers. Do not replace it with loading
  copy and do not add a second disclosure near the continuation boundary.
- When new unique offers append, recompute from the entire visible, deduplicated set—not just the new page.
- If state changes (`none` → `mixed`/`all`, `all` → `mixed`, or `mixed` → `all`), update the same DOM slot.
- Do not move focus or scroll position when the disclosure changes after append.
- Add one concise polite announcement only when the semantic state changes:
  - `Deposit and hold information is now available for some results.` for `none` → `mixed`.
  - `Deposit and hold information is available across these results; unlabeled policies remain unknown.`
    for transition to `all`.
  - `Some newly loaded results do not have provider capability for deposit and hold details.` for
    `all` → `mixed`.
- Do not announce count-only changes or repeat the full legend.
- Failed pagination keeps the previous aggregate and card signals unchanged. The existing continuation
  retry owns the error; do not add a policy error unless policy data itself failed for the appended page.

### Pointer and keyboard

- The set statement and legend are informational and receive no click handler or tab stop.
- A card signal is informational and does not become a button, tooltip, popover, or nested link.
- Tab order remains result controls → cards in DOM order → load-more/coverage controls.
- `Enter` on a linked card keeps current navigation. No policy state intercepts or reroutes it.
- Existing detail disclosure buttons retain native `Enter`/`Space`, `aria-expanded`, and
  `aria-controls`; focus stays on the button after expand/collapse.
- Confirmation and outbound links retain visible focus and accurate new-tab names.
- Every interactive target remains at least 44px high. Status changes never create multiple live regions
  per card.

## Responsive layout

### Mobile — 375px

- Result disclosure is one column, full width, and sits outside the grid with `mb-4`.
- Use `px-4 py-3`; heading and body wrap naturally. No icon reserves horizontal space.
- Card signal uses the full card content width and wraps below price metadata, before the image.
- Monetary ranges and provider text use `break-words [overflow-wrap:anywhere]`; no horizontal scroll,
  clipping, or overlap with Deal Score, price, image, or `View deal`.
- The set disclosure adds no control in normal states. Retry, if present, is full width and `min-h-11`.
- Full detail remains one column with `p-3.5`; source and long policy text wrap anywhere.

### Desktop — 1280px

- Disclosure spans the result-grid width, not one card column, and remains directly above the grid.
- Limit readable text to `max-w-3xl`; do not create an empty right-side panel or sticky notice.
- Card signals remain in each card's normal flow and do not equalize card heights with fixed or truncated
  text.
- Full evidence may use the existing two-column fact grid, but DOM reading order must not change.

## Tailwind patterns using existing tokens

Set disclosure base (`aside`):

`mb-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-[color:var(--text-1)]`

Set heading:

`font-display text-sm font-bold leading-5 text-[color:var(--text-1)]`

Set body:

`mt-1 max-w-3xl text-sm leading-6 text-[color:var(--text-2)]`

Capability-loading status uses the same neutral base plus:

`flex min-h-11 items-center`

Capability-error base:

`mb-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 py-3`

Do not use `--warning-soft` or `--error-soft` for provider incapability or set-level unknown. The result
request's existing true error may retain `--error-soft`.

Card signal:

`rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-2)] break-words [overflow-wrap:anywhere]`

Use the same neutral pattern for complete and explicit-none. For partial and conflicting only, add
`border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`. State remains understandable from
text without color.

Retry button:

`btn btn-outline mt-3 min-h-11 w-full sm:w-auto`

Full provider-incapable panel:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3.5 sm:p-5`

All focusable elements use the global `:focus-visible` treatment and `--border-focus`; do not remove the
outline. Do not introduce colors or font sizes outside `app/globals.css`.

## Accessibility semantics

- All-unsupported and legends use a named `<aside aria-labelledby>` or named `<section>` in normal reading
  order. No `role="alert"` and no `aria-live` after settled load.
- The capability-loading and independent-error messages use exactly one polite, atomic status region.
- The grid keeps its existing `aria-busy` behavior. Do not mark every card busy.
- Decorative icons, if any are retained, are `aria-hidden="true"`; text communicates the state.
- Do not use a check mark or success color for `explicit_none`.
- Forced-colors mode retains borders and text labels; color is never the only state cue.
- Heading IDs are stable and unique. Pagination updates the same disclosure node rather than mounting
  duplicates.
- Screen-reader output must never describe an unlabeled result as deposit-free.

## Analytics specification

Add one set-level exposure event:

**Event:** `hotel_funds_policy_set_viewed`

Fire when the settled disclosure is at least 50% visible for 1 second. Deduplicate by bounded hash of
`queryId + normalized criteria version + capabilityState`; do not include raw destination, hotel IDs,
hotel names, URLs, provider prose, or amounts.

Properties:

| Property | Type / allowed values |
|---|---|
| `capabilityState` | `'none' \| 'mixed' \| 'all' \| 'error'` |
| `visibleBookableCount` | non-negative integer |
| `supportedOfferCount` | non-negative integer |
| `completeCount` | non-negative integer |
| `partialCount` | non-negative integer |
| `conflictingCount` | non-negative integer |
| `explicitNoneCount` | non-negative integer |
| `notReturnedCount` | non-negative integer |
| `surface` | `'deal_feed'` |

Count properties describe validated visible offers only. `visibleBookableCount` equals supported plus
unsupported valid offers. On `error`, preserve known visible count but set evidence counts and supported
count to `0` rather than guessing.

Rules:

- Do not fire on loading, empty, locked-only, sample-only, inert stale results, or a disclosure scrolled
  out before one second.
- Pagination may fire a new exposure only if the categorical capability state changes. Count-only changes
  do not produce another exposure for the same query view.
- Stop firing `hotel_funds_policy_summary_viewed` for suppressed unsupported or `not_returned` card rows.
- Keep card exposure analytics for visible qualifying signals if the existing event remains useful; its
  `policyState` must be one of `complete`, `partial`, `conflicting`, or `explicit_none`.
- Keep `hotel_funds_policy_details_opened` and `hotel_funds_policy_confirm_clicked` for the selected hotel.
- Analytics failure never blocks rendering, navigation, retry, or handoff.
- Do not infer deposit-attributed abandonment from dwell time or scroll. Attribution requires an explicit
  traveler reason or policy-confirmation action.

## State matrix and required fixtures

| Fixture | Set output | Card outputs |
|---|---|---|
| 20 unsupported/not-returned offers | One all-unsupported statement | Zero signals |
| Complete + explicit-none + capable/not-returned + unsupported/not-returned | One mixed legend | Two signals |
| All capable: complete + partial + conflicting + explicit-none | One all-capable legend | Four signals |
| All capable, all not-returned | One all-capable legend | Zero signals |
| Unsupported paired with complete | One all-unsupported statement | Zero; diagnostic only |
| Initial loading | No deposit disclosure | No policy skeleton rows |
| Settled cards, capability refresh | One polite loading status | No active card signals |
| Settled cards, capability error | One neutral error status | Zero signals |
| Empty results | No disclosure | No cards |
| Page 1 all unsupported; page 2 adds capable complete | Same slot changes to mixed legend | Only complete card signals |
| Append fails | Previous disclosure retained | Previous signals retained |
| Filter leaves only capable offers | Same slot changes to all legend | Qualifying signals only |

## Acceptance criteria

1. The live host is `DealFeed`, and there is never more than one set disclosure in its result section.
2. An all-unsupported set at any pagination depth has exactly one visible unavailability statement and
   zero card warnings.
3. Mixed and all-capable sets always carry the no-label legend, even when every current card happens to
   contain returned evidence.
4. Only valid `complete`, `partial`, `conflicting`, and `explicit_none` evidence produces a card signal.
5. `not_returned`, unsupported, malformed, loading, and error never produce per-card policy chrome.
6. Capability is normalized by providers and not inferred in React.
7. Full evidence persists unchanged through detail and handoff. Provider incapability and capable-provider
   offer absence use different exact headings and copy.
8. No state says or implies no deposit unless evidence is valid `explicit_none` for a visible scope.
9. At 375px, the longest range/percentage/provider wording wraps without horizontal scrolling or overlap.
   At 1280px, the disclosure spans the grid and does not become a card-column banner.
10. Keyboard order and focus remain stable through filtering, sorting, pagination, disclosure changes,
    expansion, and retry. No informational row adds a tab stop.
11. Loading and independent error use one polite live region; settled notices use none.
12. The set-level event is exposure-qualified, categorical/count-only, bounded, and deduplicated. Suppressed
    card rows emit no exposure event.
13. UI tests cover every fixture in the state matrix plus accessible names, roles, focus behavior, and
    the exact copy in this spec.
14. `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` exit 0 before UI handoff.

## Implementation handoff

`UI-HOTEL-DEPOSIT-HOLD-01` should implement the result-set disclosure component, conditional card signal,
neutral full-detail capability treatment, accessibility, responsive classes, analytics hook contract, and
fixtures without changing provider/API business logic. It must mount the set-level UI in `DealFeed`, not
only around `HotelCard`.

Because the production `ApiDeal` path lacks provider-normalized capability and evidence, UI must create
`DEV-HOTEL-DEPOSIT-HOLD-01` for the provider/type/cache/API/selected-context bridge before claiming the live
repair is complete. Until that bridge lands, no fallback provider-capability claim may be shown in
production.
