# UXDES-HOTEL-TOTAL-PRICE-TAX-01: Hotel Total-Price and Tax Confidence — Design Spec

Date: 2026-08-03  
Stage: UX Design  
Priority: P0  
Input: `docs/pipeline/hotel-total-price-tax/02-research.md`  
Upstream contracts: `docs/pipeline/hotel-total-stay-cost/03-design.md` and `docs/pipeline/hotel-resort-fee/03-design.md`  
Handoff: `UI-HOTEL-TOTAL-PRICE-TAX-01`

## 0. Outcome and non-negotiable boundaries

This repair gives a traveler two distinct answers before provider handoff:

1. what expaify knows about **taxes**; and
2. what expaify knows about **mandatory property charges**.

It does not create a fifth stay-cost class. The inherited outer classification remains, verbatim:

```ts
type HotelStayCostState =
  | 'provider_total'
  | 'partial_total'
  | 'expaify_estimate'
  | 'nightly_only'
```

This ticket adds a separate disclosure-quality dimension. It never changes the displayed money, its attribution, sorting, or Deal Score. Taxes and mandatory property charges are two independent categories. For each applicable category, inclusion in a displayed provider total and collection timing are also independent facts. In particular, `included` plus `property` is valid and must render as “Included in provider total · Pay at property.”

The repair replaces both current fragments—“before taxes and fees” and the separate static mandatory-fee sentence—with one composition unit. This is a copy refinement to the inherited stay-cost spec, not a state-model change: its four classes, derivation, amount attribution, occupancy, and provenance remain authoritative, while its generic `before taxes and fees` scan/detail suffixes are superseded wherever this two-category composition unit renders. It does not add a third caveat, a receipt table, a badge, or a tooltip.

The following stay outside this unit:

- refundable deposits and authorization holds, which remain in “Deposits and card holds”;
- optional or conditional purchases;
- cancellation and payment schedules;
- Deal Score inputs or explanation;
- price freshness;
- provider booking conversion.

No provider-confirmed charge state is reachable through Hotellook today. UI must implement the honest fallback on current data. Provider itemization, explicit negative evidence, inclusion, collection, offer continuity, and analytics persistence are DEV-gated.

## 1. Reachability and stage contract

### 1.1 Disclosure states

| `HotelPriceDisclosureState` | Production-reachable now | UI/TEST expectation |
|---|---:|---|
| `fully_itemized` | No | Fully specified. Fixture/presentation coverage only after DEV supplies the evidence contract; do not fail the current route for absence. |
| `provider_total_breakdown_unknown` | No | Fully specified. DEV-gated. |
| `partially_itemized` | No | Fully specified. DEV-gated. |
| `incomplete` | Yes | Required. Both categories currently render `not confirmed`. |
| `unavailable` | Component-reachable | Preserve the existing price-unavailable treatment. Render the composition unit only when at least one category has independent valid evidence; construct the other category as `not_returned`. |

### 1.2 Surfaces

| Surface | Reachability | Required behavior |
|---|---:|---|
| Collapsed `HotelCard` | Latent; card is not mounted in the live route | One always-visible two-clause scan line. Component-test at 375px and 1280px. |
| Expanded `HotelCard` “Price scope” | Latent | Inherited cost claim followed by two category rows. |
| `/book` hotel review | Route branch exists but has no live entry from the unmounted card | Two non-collapsible category rows before the provider CTA. Component-test. |
| Provider-confirmed examples | No adapter path | Design/fixture contract only until DEV work lands. |

TEST must not treat missing live navigation or missing provider-confirmed adapter output as a failure of this UI ticket. It must test production fallback and component reachability. The known repository test failures in `scorePresentation`, `QuietStayEvidenceLedger`, and `HotelDealCriteriaHandoff` are inherited and unrelated unless this ticket changes their result.

## 2. Information architecture and hierarchy

### 2.1 Collapsed comparison hierarchy

Within the existing hotel card, the reading order is:

1. property identity and fit evidence;
2. primary nightly/stay price;
3. Deal Score;
4. inherited stay-cost scan line;
5. **one** composition line: `Taxes: {status} · Mandatory property charges: {status}`;
6. deposits/card holds and other supporting evidence;
7. “Review hotel” action.

Price and Deal Score remain primary. The composition line is secondary but always visible. It cannot be clamped or hidden behind expansion because it changes the meaning of price comparison.

### 2.2 Expanded “Price scope” hierarchy

Order is fixed:

1. heading `Price scope`;
2. inherited stay-cost claim;
3. inherited stay-cost provenance;
4. occupancy statement, when the inherited spec requires one;
5. heading `Taxes and mandatory charges`;
6. `Taxes` row;
7. `Mandatory property charges` row;
8. existing rate-check/freshness content.

The charge rows are siblings of the inherited cost claim, not children of Deal Score and not part of “Deposits and card holds.”

### 2.3 Provider handoff hierarchy

On the last expaify-controlled screen, order is:

1. selected property;
2. inherited selected cost claim and Deal Score;
3. other decision evidence;
4. provider panel heading `Check rooms with provider`;
5. handoff explanation;
6. **non-collapsible** `Taxes and mandatory charges` summary with exactly two rows;
7. cancellation/modification guidance;
8. provider CTA;
9. new-tab cue.

The category summary must be visible without opening “Show offer details,” “Deposits and card holds,” or any other disclosure. Itemized charge records may be collapsible beneath their visible category summary, but the category status, inclusion, and collection fields may not be.

## 3. Evidence and presentation contract

### 3.1 DEV-gated evidence vocabulary

This is the required future evidence vocabulary; UI must not add it to `lib/types.ts` in the UI stage.

```ts
type HotelRequiredChargeState =
  | 'itemized'
  | 'included_unitemized'
  | 'applies_amount_unknown'
  | 'explicit_none'
  | 'not_returned'
  | 'conflicting'

type HotelChargeTotalRelationship = 'included' | 'excluded' | 'unknown'
type HotelChargeCollection = 'online' | 'property' | 'split' | 'unknown'

type HotelPriceDisclosureState =
  | 'fully_itemized'
  | 'provider_total_breakdown_unknown'
  | 'partially_itemized'
  | 'incomplete'
  | 'unavailable'
```

Taxes and mandatory property charges each receive their own offer-bound evidence object. Both carry `offerId`, `supplier`, a safe `sourceLabel`, supported scope, optional `fetchedAt`, state, total relationship, and collection timing. They are never combined into `taxesAndFees`.

`itemized` may carry a provider-supplied category total and provider-named required-charge records. All values use `{ priceCents: number; currency: string }`. The UI never sums records and presents the result as a provider total. Provider charge names remain verbatim except for safe whitespace normalization; expaify does not rename or recategorize them.

### 3.2 State validity

| State | Valid evidence | Invalid interpretation |
|---|---|---|
| `itemized` | Provider supplied a category amount or one or more named required-charge records with valid integer-minor-unit money. | A bare or malformed number; an expaify-calculated sum attributed to the provider. |
| `included_unitemized` | Provider explicitly says the category is included in its total but provides no category amount. | Inferring inclusion because no amount appears. |
| `applies_amount_unknown` | Provider says a required charge applies but amount is absent, variable, or incalculable. | Treating it as zero or `not_returned`. |
| `explicit_none` | Capability-gated provider evidence explicitly reports none for this offer and scope. | Numeric zero, silence, unsupported capability, or a generic “all inclusive” label without category coverage. |
| `not_returned` | Missing, malformed, unsupported, stale, mismatched offer/supplier/scope, provider error, or failed initial load. | “None,” “included,” or any positive claim. |
| `conflicting` | Retained records disagree about existence, inclusion, or collection. | Choosing a preferred record or degrading silently to `not_returned`. |

Optional/conditional items are rejected from this contract. Deposits and card holds never become charge records.

### 3.3 Exact derived-state precedence

A single pure DEV helper derives the disclosure state. UI does not independently re-derive it.

1. `unavailable` when inherited state is `nightly_only` with `price_unavailable`.
2. `fully_itemized` when inherited state is `provider_total`; both categories are `itemized` or `explicit_none`; every applicable category has known total relationship and collection; neither conflicts.
3. `provider_total_breakdown_unknown` when a provider total exists and either:
   - the provider explicitly says all required taxes and mandatory charges are included but one or both category amounts are not supplied; or
   - neither category is documented.
4. `partially_itemized` when any category is documented while the other is missing, applies-but-unpriced, excluded, or conflicting. Every inherited `partial_total` maps here.
5. `incomplete` for `expaify_estimate` or priced `nightly_only` when neither category is documented.

The first matching rule wins. All-inclusive-without-breakdown and provider-total-with-no-category-evidence share a measurement stratum but use different visible copy.

## 4. Shared copy grammar

All composition strings must come from one shared presentation helper. Do not inline variants separately in `HotelCard` and `BookingFlow`.

### 4.1 Provider label

Use `providerDisplayName` only when `hasProviderName` succeeds. Otherwise use “the provider” in prose and omit a fake source line. Never display a raw hostname or internal provider token as evidence attribution.

### 4.2 Scan status map

The collapsed line uses these exact status fragments:

| Category evidence | Scan fragment |
|---|---|
| `itemized` with provider category total and `included` | `{amount} included` |
| `itemized` with provider category total and `excluded` | `{amount} excluded` |
| `itemized` with provider category total and `unknown` | `{amount}; inclusion not confirmed` |
| `itemized` without provider category total | `itemized` |
| `included_unitemized` | `included; amount not itemized` |
| `applies_amount_unknown` | `applies; amount unknown` |
| `explicit_none` with named provider | `none reported by {Provider}` |
| `explicit_none` without safe provider label | `none reported by provider` |
| `not_returned` | `not confirmed` |
| `conflicting` | `details conflict` |

“Included” and “excluded” mean relationship to a displayed **provider total** only. When inherited state is `expaify_estimate` or `nightly_only`, do not render either word even if malformed upstream input contains a relationship; render the honest state fragment without a total relationship.

The complete scan sentence is always:

> `Taxes: {tax fragment} · Mandatory property charges: {charge fragment}`

Current production fallback, verbatim:

> `Taxes: not confirmed · Mandatory property charges: not confirmed`

No final period is required in the scan strip. The middle dot is visual punctuation only; the accessible name uses two sentences (§8.3).

### 4.3 Detail row anatomy

Each category row is a `<div>` inside a `<dl>` and exposes fields in this order:

1. `<dt>` category name;
2. state/amount sentence;
3. relationship sentence;
4. collection sentence;
5. provenance sentence for provider-confirmed facts;
6. optional item list trigger, only after the visible summary.

Exact labels:

- `Taxes`
- `Mandatory property charges`

Exact state/amount copy:

| State | Detail copy |
|---|---|
| `itemized`, category total supplied | `{amount}.` |
| `itemized`, records but no provider category total | `Itemized by the provider; no category total was provided.` |
| `included_unitemized` | `Included in the provider total; separate amount not provided.` |
| `applies_amount_unknown` | `Applies; amount not available. The price shown is not a complete payable total.` |
| `explicit_none`, named provider | `{Provider} reports no {category noun} for this selected offer.` |
| `explicit_none`, unnamed provider | `The provider reports no {category noun} for this selected offer.` |
| `not_returned` | `Not confirmed for this selected offer.` |
| `conflicting` | `Provider details conflict. Confirm the amount and terms before booking.` |

Category nouns are `taxes` and `mandatory property charges`. Do not use `fees` alone.

Exact relationship copy, suppressed for `explicit_none`. For `included_unitemized`, the state sentence “Included in the provider total; separate amount not provided.” already supplies the relationship field and must not be followed by a duplicate inclusion sentence:

| Context | Copy |
|---|---|
| Provider total + `included` | `Included in provider total.` |
| Provider total + `excluded` | `Not included in provider total.` |
| Provider total + `unknown` | `Inclusion not confirmed.` |
| `expaify_estimate` or `nightly_only` | `No provider total is available to confirm inclusion.` |

Exact collection copy, suppressed only for `explicit_none`:

| Value | Copy |
|---|---|
| `online` | `Collected online.` |
| `property` | `Pay at property.` |
| `split` | `Split between online and property.` |
| `unknown` | `Payment timing not confirmed.` |

Exact provenance:

> `Source: {Provider} · {scope label}{optional checked date}`

Use the existing scope labels and safe checked-date formatter already established by evidence panels. Omit the checked segment when missing or unparseable. `not_returned` uses `Source checked: {Provider} · Scope not provided` only when a safe source label exists. `conflicting` lists each retained source inside expanded item details; it does not name one source as authoritative in the summary.

### 4.4 Required independence examples

These paired outputs are normative:

| Inclusion | Collection | Visible output |
|---|---|---|
| `included` | `property` | `Included in provider total. Pay at property.` |
| `excluded` | `property` | `Not included in provider total. Pay at property.` |
| `included` | `online` | `Included in provider total. Collected online.` |
| `included` | `split` | `Included in provider total. Split between online and property.` |
| `unknown` | `property` | `Inclusion not confirmed. Pay at property.` |
| `included` | `unknown` | `Included in provider total. Payment timing not confirmed.` |

Never replace any pair with “due later.” Never claim “No amount due at the property” unless both this required-charge evidence and the separate funds-policy evidence independently prove absence; this ticket does not introduce that aggregate claim.

## 5. Surface specification

### 5.1 Collapsed `HotelCard`

Remove both the combined `per night before taxes and fees` line inside `Price` and the separate `feeScanCopy`. After the inherited stay-cost summary strip, render the shared composition line and before the funds-policy summary.

```tsx
<p
  className="mt-2 break-words text-xs font-medium leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]"
  aria-label={compositionAriaLabel}
>
  {compositionScanCopy}
</p>
```

Rules:

- no `truncate`, `line-clamp-*`, `whitespace-nowrap`, icon, tooltip, chip, or link;
- no warning color for ordinary unknown data;
- `conflicting` may use `text-[color:var(--warning)]` but must still include the literal “details conflict”;
- an invalid price does not suppress independently valid charge evidence;
- when price is unavailable and neither category has independent valid evidence, preserve the existing price-unavailable treatment and omit the composition unit; when either category has evidence, render both clauses and construct the other as `not confirmed`.

Review-action accessible text includes the inherited price/stay-cost clause, then the two category sentences, then provider/freshness and handoff cues. Do not say “before taxes and fees.”

### 5.2 Expanded `HotelCard` “Price scope”

Replace the repeated combined disclaimer and static fee line with:

```tsx
<section aria-labelledby={`hotel-price-composition-${hotel.id}`} className="mt-3">
  <h4 id={`hotel-price-composition-${hotel.id}`} className="font-medium text-[color:var(--text-1)]">
    Taxes and mandatory charges
  </h4>
  <dl className="mt-2 grid gap-3">
    {/* Taxes row, then Mandatory property charges row */}
  </dl>
</section>
```

Each row uses:

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3 py-2
```

`<dt>`: `text-sm font-medium text-[color:var(--text-1)]`  
Primary row statement: `mt-1 text-sm leading-6 text-[color:var(--text-2)]`  
Relationship/collection: same size and color, separate sentences or a visible ` · ` within one paragraph  
Provenance: `mt-1 break-words text-xs leading-5 text-[color:var(--text-3)]`

Do not repeat the scan sentence inside the expanded block. Expanded content replaces it with the two complete rows.

### 5.3 Non-collapsible `/book` handoff

Replace `feeHandoffCopy` with a bordered summary before cancellation/modification guidance and before the provider CTA.

Heading:

> `Taxes and mandatory charges`

Intro copy by outer context:

| Context | Copy |
|---|---|
| Provider total | `Review what the provider says is included and where each amount is collected.` |
| Expaify estimate | `The displayed stay amount is an expaify estimate, not a provider total. Review both categories before continuing.` |
| Nightly only, priced | `Only a nightly price is available. Review both categories before continuing.` |
| Price unavailable | `No usable lodging price is available. Review any charge evidence before continuing.` |

Then render Taxes and Mandatory property charges using the exact detail rows from §4.3. The current production fallback reads, in order:

> **Taxes**  
> Not confirmed for this selected offer.  
> No provider total is available to confirm inclusion.  
> Payment timing not confirmed.

> **Mandatory property charges**  
> Not confirmed for this selected offer.  
> No provider total is available to confirm inclusion.  
> Payment timing not confirmed.

After the rows, retain the inherited boundary sentence:

> `{Provider} confirms the final total before you pay.`

When partner name is unavailable:

> `The booking partner confirms the final total before you pay.`

This sentence does not turn unknown categories into provider-confirmed facts. It describes the next step only.

The provider-panel explanatory copy becomes:

> `The provider shows room options, live availability, its final price, cancellation policy, and terms. Compare its tax and mandatory-charge details with the expaify summary before you continue.`

CTA visible labels remain `Check rooms at {Provider}` / `Check rooms at provider`. The CTA accessible name appends the selected cost claim and both category summaries in the same order. It never says “before taxes and fees.”

### 5.4 Item records

When DEV supplies more than one named charge record, a category row may add a `<details>` after provenance:

- closed label: `Show {n} tax items` or `Show {n} mandatory charge items`;
- open label: native details behavior may retain the same summary label;
- list order: provider order, stable by record identifier when supplied;
- each record shows provider name, `formatMoney(record.amount)`, basis/scope exactly as returned, and collection when record-level evidence exists;
- no expaify-computed category total;
- no item disclosure for `not_returned`, `explicit_none`, or `included_unitemized` with no records.

The `<summary>` is at least 44px tall and appears after the non-collapsible category status. Closing it cannot hide the status, inclusion, or timing.

## 6. Fallback, loading, empty, and error hierarchy

### 6.1 Normalization precedence

Normalize evidence before presentation. For each category, first match wins:

1. mismatched offer, supplier, or unsupported scope → `not_returned`;
2. malformed money, unsafe integer, missing currency, unsupported capability, or optional/conditional record → discard invalid record; if no valid evidence remains, `not_returned`;
3. retained disagreement about existence, inclusion, or collection → `conflicting`;
4. capability-gated explicit negative → `explicit_none`;
5. valid itemized evidence → `itemized`;
6. explicit inclusion without amount → `included_unitemized`;
7. explicit applicability without amount → `applies_amount_unknown`;
8. otherwise → `not_returned`.

Stale or supplier/offer-mismatched evidence is not shown as a provider fact. It becomes `not_returned`; telemetry may retain the degradation reason without exposing internal error language.

### 6.2 Loading

The existing selected-offer price and last known valid category evidence remain visible during refresh. Add `aria-busy="true"` to the composition region and one non-blocking caption:

> `Checking price details…`

Do not replace known evidence with skeletons or spinners. On an initial load with no evidence, render the two `not confirmed` rows immediately and the checking caption beneath them. This avoids a blank composition region and prevents loading from implying zero charges.

The collapsed scan line remains the fallback; no animated indicator enters the scan sentence.

### 6.3 Empty/not returned

There is no blank or omitted category. Construct and render `not_returned` independently for each category. Exact fallback:

> `Not confirmed for this selected offer.`  
> `No provider total is available to confirm inclusion.` or `Inclusion not confirmed.` according to outer class  
> `Payment timing not confirmed.`

Silence is never rendered as “none,” “included,” or zero.

### 6.4 Provider or network error

On initial failure, show the same `not_returned` rows plus a single region-level message:

> `Price details could not be checked. Confirm taxes and mandatory property charges with the provider.`

If retry exists on that surface, button copy is `Retry price details`. The button is secondary, 44px minimum, and belongs after both rows. Retry affects only the composition fetch; it does not disable or alter the provider handoff CTA.

During retry, button copy is `Checking…`, disabled, with `aria-busy="true"`. On success, announce `Price details updated.` in the existing polite status region. On failure, keep focus on the retry button and announce the error. Last known valid evidence remains visible; do not downgrade it solely because a refresh failed.

### 6.5 Conflicting evidence

Use the normal bordered row plus `border-[color:var(--gold)] bg-[color:var(--warning-soft)]`; text remains `var(--text-1)`/`var(--text-2)`, with `var(--warning)` reserved for the conflict statement. Exact copy:

> `Provider details conflict. Confirm the amount and terms before booking.`

Relationship and timing still show their known values only if they are not the conflicting dimensions; conflicting dimensions use `Inclusion not confirmed.` or `Payment timing not confirmed.`. Retained sources appear only in item details. Do not choose a winner.

### 6.6 All-inclusive without breakdown

For each explicitly covered category:

> `Included in the provider total; separate amount not provided.`  
> `{collection copy}`  
> `{provenance}`

The first sentence satisfies both state/amount and relationship requirements. Do not repeat “Included in provider total.” immediately after it.

If the provider's all-inclusive claim does not explicitly cover both categories, only the covered category uses this state; the other remains `not_returned`.

### 6.7 Applies but amount unavailable

Always show:

> `Applies; amount not available. The price shown is not a complete payable total.`

This state cannot use `provider_total_breakdown_unknown`; it is `partially_itemized`. The scan line reads `applies; amount unknown`. The provider CTA remains enabled because expaify does not transact, but the warning is visible before it.

### 6.8 Price unavailable

Preserve `PriceUnavailable` as the only lodging-price treatment. Do not reconstruct a total from charge evidence. When at least one category has independent valid evidence, render both rows and construct the absent category as `not confirmed`. When neither category has evidence, omit the composition region on the unavailable card. Deal Score remains unavailable under its existing rules.

### 6.9 Currency mismatch

Never add category money in a different currency to a lodging total. Format each provider amount in its own valid currency and use the relationship copy only when the provider explicitly supplied it. Do not show an expaify sum or currency conversion. If a provider claims a single-category total composed from records with incompatible currencies and supplies no category total, use `itemized` without a category total and retain the individual currencies in item details.

## 7. Responsive and visual specification

### 7.1 Shared tokens

Use only existing tokens from `app/globals.css`:

- background: `bg-[color:var(--bg-raised)]` or surrounding surface;
- border: `border-[color:var(--border)]`;
- primary text: `text-[color:var(--text-1)]`;
- secondary text: `text-[color:var(--text-2)]`;
- provenance: `text-[color:var(--text-3)]`;
- action/focus: `var(--brand)`, `var(--focus-ring)`, global `:focus-visible`;
- conflict: `var(--warning)`, `var(--warning-soft)`, and existing `--gold` border token;
- error text: `var(--error-text)`, never `var(--error)` as text;
- radius: `rounded-[var(--radius-control)]`.

Do not add colors, shadows, font sizes, icons, or warning badges.

### 7.2 Mobile — 375px

- composition regions use one column;
- card scan sentence wraps naturally, preserving full words and both categories;
- do not force the middle dot to remain on the first line;
- row padding is `px-3 py-2`; handoff container is `p-4`;
- text is never smaller than `text-xs`/11.5px, and detail copy uses `text-sm`;
- amounts and provider labels use `break-words [overflow-wrap:anywhere]` where necessary;
- no horizontal scroll, fixed width, absolute positioning, or two-column charge layout;
- CTA remains full-width and at least 44px tall;
- item summaries remain at least 44px tall.

The expected scan wrap may be two or three lines. Both category labels and both statuses must remain readable without interaction.

### 7.3 Desktop — 1280px

- card scan remains one wrapping paragraph; do not manufacture columns inside the card;
- expanded and handoff category rows may use `sm:grid-cols-2`, but reading and DOM order remain Taxes then Mandatory property charges;
- the two rows have equal visual weight; taxes are not styled as more important solely because they appear first;
- handoff summary remains within the provider panel and does not become a side rail or sticky overlay.

### 7.4 Narrow-content and long-copy edge cases

Test a 320px content width, a four-digit localized amount, a 30-character provider label, and a 60-character provider charge name. Text wraps; it never overlaps the price, Deal Score, CTA, or external-link icon. Currency/amount may wrap as a unit only if the existing `formatMoney` output allows it; raw cents never appear.

## 8. Interaction, keyboard, focus, and assistive output

### 8.1 Non-interactive summary

The scan line and two category rows are informational. Do not add `tabIndex`, tooltip triggers, buttons, or `role="alert"`. Unknown evidence is neutral, not an error requiring interruption.

### 8.2 Keyboard order

Collapsed card:

1. existing preceding card controls;
2. `Review hotel`;
3. any existing following control.

The composition line adds no stop.

Expanded/handoff when item details or retry exist:

1. Taxes item disclosure, if present;
2. Mandatory property-charge item disclosure, if present;
3. retry, if present;
4. existing provider CTA.

Native `<details>/<summary>` behavior applies: Enter or Space toggles; focus stays on summary; closing does not hide the category summary. Escape has no custom behavior.

### 8.3 Screen-reader order and copy

Use semantic headings and one `<dl>` per composition region. DOM and reading order are always:

> inherited cost claim → Taxes → Mandatory property charges → boundary sentence → provider action

The collapsed visual middle dot must not be the only separator. Exact accessible label for current fallback:

> `Taxes: not confirmed. Mandatory property charges: not confirmed.`

For a confirmed example:

> `Taxes: $42 included. Mandatory property charges: $30 excluded.`

Review-action/CTA accessible names summarize, rather than duplicate every provenance field. Pattern:

> `{visible action} for {property}. {new-tab cue}. {selected cost claim}. Taxes: {scan status}. Mandatory property charges: {scan status}. {final-total boundary}.`

Do not include the middle dot as spoken content. Do not repeat provider names more than needed for comprehension.

### 8.4 Live regions

Only check/retry outcomes use the existing polite status region. Exact announcements:

- initial or retry loading: `Checking price details.`;
- success: `Price details updated.`;
- failure: `Price details could not be checked. Confirm taxes and mandatory property charges with the provider.`

Do not announce the unchanged rows on every render. When evidence changes after a successful check, update the status announcement once; the user can navigate back to the rows.

### 8.5 Handoff behavior

Choosing the provider CTA opens the existing sponsored deeplink in a new tab. The price summary remains on expaify. Measurement failure never blocks navigation. Returning from the provider may show the existing optional mismatch prompt; focus is not moved automatically to it.

## 9. Return feedback copy

Keep the prompt:

> `Did the partner details match?`

Supporting copy:

> `Optional: tell us the main mismatch so we can improve hotel price details.`

Replace the combined `Price or fees did not match` option with exactly four single-select reasons:

| Analytics value | Visible label |
|---|---|
| `tax_amount_changed_or_appeared` | `Tax amount changed or appeared` |
| `mandatory_property_charge_changed_or_appeared` | `Mandatory property charge changed or appeared` |
| `displayed_total_other_mismatch` | `Displayed total did not match for another reason` |
| `pay_at_property_amount_unexpected` | `Pay-at-property amount was unexpected` |

Preserve unrelated existing reasons. Do not add free text. Legend becomes `What was the main mismatch?`. Send remains disabled until one option is selected. `Cancel` closes the form, clears selection, and restores focus to `Report a mismatch`.

The current optimistic success statement is outside this ticket's delivery-acknowledgement scope. UI may preserve it, but analytics acceptance must be repaired before the product interprets submissions as persisted.

## 10. Attempt-level measurement contract — DEV-gated

### 10.1 Attempt identity and privacy

Create one opaque UUID `handoffAttemptId` when the hotel review mounts. It is stable through view, continue, document visibility return, back, and mismatch selection. A new ID is created only when a genuinely new hotel review attempt mounts; ordinary rerenders, details toggles, retries, and return-prompt interactions do not replace it.

It is product telemetry, not an offer ID or provider booking ID. Do not include property name, URL, dates, guest data, free text, payment data, or query parameters in it.

### 10.2 Exact lifecycle payload

Every scoped lifecycle event requires `handoffAttemptId` and `priceDisclosureState`. The server must validate event name, exact allowed keys, required keys, and value enums together.

| Event | Required purpose-specific fields |
|---|---|
| `hotel_handoff_viewed` | `handoffAttemptId`, `priceDisclosureState`, `stayCostState`, `taxState`, `mandatoryChargeState`, `source` |
| `hotel_handoff_continue_clicked` | `handoffAttemptId`, `priceDisclosureState`, `source`, `partnerNamed` |
| `hotel_handoff_returned` | `handoffAttemptId`, `priceDisclosureState`, `awayDurationBucket` |
| `hotel_handoff_back_clicked` | `handoffAttemptId`, `priceDisclosureState` |
| `hotel_handoff_return_reason_selected` | `handoffAttemptId`, `priceDisclosureState`, `reason` |

Valid values:

- `priceDisclosureState`: the five members in §3.1;
- `stayCostState`: the four inherited members;
- `taxState` and `mandatoryChargeState`: the six charge states in §3.1;
- `reason`: the four price reasons in §9 plus preserved non-price reasons;
- `awayDurationBucket`: existing `<5s`, `5–30s`, `30–120s`, `120s+` values;
- `source` and `partnerNamed`: existing validated forms.

Audit and reconcile existing emitted `policyState`, `obligationTypes`, invoice/help/loyalty fields against `EVENT_PROPERTIES`, `REQUIRED_PROPERTIES`, and `validPropertyValue` in the same DEV change. The API rejects the whole event on a disallowed or unvalidated property; adding only new keys leaves the present lifecycle invalid.

Analytics delivery is best-effort and never changes visual state, disables actions, delays handoff, or exposes an error to the traveler.

### 10.3 Measure definitions

Pre-handoff non-continuation:

> distinct viewed attempts with no continue click within 30 minutes / distinct viewed attempts

Apply a 24-hour maturity window; group by `priceDisclosureState`; report raw numerator, denominator, and continue-click rate. Do not call this booking abandonment.

Return rate:

> distinct returned attempts / distinct continued attempts

This is diagnostic, not booking failure.

Price-surprise report rate:

> distinct returned attempts selecting one of the four price reasons / distinct returned attempts

Also report prompt response rate and each reason separately. Reason selection is optional and biased. No measure is provider booking conversion; that remains blocked on an authorized affiliate/provider conversion signal.

### 10.4 Moderated comprehension acceptance

Test at least the current incomplete fallback and one fully itemized fixture. Before handoff, ask participants for:

1. displayed lodging/stay amount;
2. tax amount or status;
3. mandatory property-charge amount or status;
4. which amounts are included in the provider total;
5. which amounts are collected at the property;
6. confidence from 1–5.

“I don't know” is correct when the fixture intentionally says unknown. Success threshold: at least 80% answer all five factual questions consistently without opening item details, and no more than 10% interpret “pay at property” as “not included in total.” Report sample size and confidence distribution.

## 11. Implementation split

### 11.1 UI-HOTEL-TOTAL-PRICE-TAX-01 owns

- remove the combined “before taxes and fees” phrase from the current `HotelCard` and hotel handoff presentation;
- remove the separate duplicated static mandatory-fee sentence;
- add the shared, always-visible current fallback scan copy;
- add non-collapsible Taxes and Mandatory property charges rows in expanded Price scope and before the `/book` provider CTA;
- preserve the inherited stay-cost copy contract and deposits/card-holds separation;
- update action accessible names to the two-category order;
- implement 375px/1280px layout and production-reachable loading/error fallback only where current props support it;
- update presentational/component tests for current `not confirmed` state;
- preserve existing component props and shared type contracts.

UI must not widen `HotelOffer`, `BookingHotelContext`, provider adapters, API routes, analytics validators, or business logic. It must not fabricate itemized examples as production data. If a local presentational helper is introduced, its only production input in this stage is the constructed incomplete fallback.

### 11.2 DEV-HOTEL-TOTAL-PRICE-TAX-01 later owns

- add separate tax and mandatory-property-charge evidence types/normalizers;
- extend, not duplicate, the DEV-gated mandatory-property-fee contract from the resort-fee pipeline;
- enforce offer/supplier/scope/capability/money validation;
- preserve multiple provider records and independent total relationship/collection timing;
- add booking-context continuity;
- implement the single derived disclosure-state helper and exhaustive table tests;
- map provider data only through `lib/providers`, with `Result<T>` and integer-minor-unit `Money`;
- implement provider-confirmed and conflicting presentation paths;
- repair the complete analytics allowlist/required-key/value-validation contract;
- implement stable `handoffAttemptId` and the split return reasons.

### 11.3 Explicitly out of scope

- restoring live hotel-card navigation;
- reinterpreting Hotellook `priceFrom` semantics;
- adding provider APIs or credentials;
- deposits/holds aggregation;
- optional charges;
- Deal Score changes;
- price freshness changes;
- analytics delivery acknowledgement;
- booking conversion claims.

## 12. Acceptance matrix

### 12.1 UI-stage acceptance

- [ ] The four inherited stay-cost classes remain unchanged; no fifth class appears.
- [ ] Current fallback scan copy is exactly `Taxes: not confirmed · Mandatory property charges: not confirmed`.
- [ ] The combined “before taxes and fees” and duplicated static mandatory-fee copy are removed from affected hotel card/handoff composition surfaces.
- [ ] Expanded Price scope has Taxes then Mandatory property charges, both always visible.
- [ ] Handoff has the same two rows, non-collapsible, before the provider CTA.
- [ ] Inclusion and payment timing are separate sentences; unknown fields are shown, not omitted.
- [ ] Deposits/card holds remain a separate region and are not added to mandatory charges.
- [ ] Invalid price does not suppress the category fallback.
- [ ] 375px and 1280px layouts have no truncation, overlap, or horizontal scroll.
- [ ] Scan row adds no tab stop; semantic reading order is cost → Taxes → Mandatory property charges → action.
- [ ] CTA/review accessible names contain both category statuses and no ambiguous combined “fees” clause.
- [ ] No provider-confirmed claim is synthesized from current Hotellook data.
- [ ] `npx tsc --noEmit --incremental false` exits 0.
- [ ] `npm test -- --passWithNoTests` has no new ticket-caused failures; inherited failures are recorded precisely.

### 12.2 DEV-stage fixture acceptance

| Fixture | Expected scan/detail behavior | Derived state |
|---|---|---|
| Provider total; itemized tax included/online; itemized mandatory charge included/property | Both amounts visible; “included” and different collection timing remain independent. | `fully_itemized` |
| Provider total; both categories explicitly included, no breakdown | Both say included; separate amount not provided. | `provider_total_breakdown_unknown` |
| Provider total; neither category documented | Both not confirmed; provider total remains visible without a fabricated breakdown. | `provider_total_breakdown_unknown` |
| Partial total; tax itemized included; mandatory charge applies, amount unknown/excluded/property | Warning states incomplete payable total; no invented sum. | `partially_itemized` |
| Expaify estimate; no category evidence | Both not confirmed; no “included/excluded” language. | `incomplete` |
| Nightly only, priced; no category evidence | Both not confirmed; no provider-total relationship. | `incomplete` |
| Nightly price unavailable; no category evidence | Existing price-unavailable treatment only; no empty composition region. | `unavailable` |
| Nightly price unavailable; tax itemized; mandatory charge absent | Existing price-unavailable treatment plus both category rows; mandatory charge is `not confirmed`; no reconstructed lodging total. | `unavailable` |
| Explicit no tax; mandatory charge itemized | No-tax claim carries provider provenance; relationship/timing suppressed only for tax. | `partially_itemized` unless outer/full criteria satisfy `fully_itemized` |
| Included mandatory charge, payable at property; separate authorization hold | One price charge and one funds obligation; no duplication or aggregation. | Per outer/category evidence |
| Conflicting tax inclusion; known mandatory charge | Tax says conflict/inclusion unconfirmed; mandatory row remains specific. | `partially_itemized` |
| Stale, mismatched, malformed, unsupported, or failed initial evidence | Affected category degrades to `not_returned`, never zero/none/included. | Per precedence |

### 12.3 Accessibility acceptance

- [ ] Visible and accessible category order match.
- [ ] The middle dot is replaced by sentence separation in `aria-label` text.
- [ ] Item details and retry controls are 44px minimum and show the global focus ring.
- [ ] Enter/Space toggles native item details; focus does not jump.
- [ ] Loading uses `aria-busy`; outcomes use a polite status message once.
- [ ] Error text uses `--error-text`; ordinary unknown evidence is neutral.
- [ ] Long provider/charge names wrap without obscuring controls.

## 13. Handoff

Create `UI-HOTEL-TOTAL-PRICE-TAX-01` with this document as its implementation contract. UI implements the honest production fallback and non-collapsible two-category hierarchy without changing shared types or provider logic. A subsequent DEV ticket is required for provider-confirmed evidence, booking-context continuity, derived-state logic, split mismatch telemetry, and analytics persistence.
