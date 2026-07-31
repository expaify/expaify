# UXDES-HOTEL-PAYMENT-OPTIONS-01 — Hotel Payment-Option Confidence — Design Spec

**Stage:** UX Design · **Ticket:** UXDES-HOTEL-PAYMENT-OPTIONS-01 · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-payment-options`  
**Upstream:** `docs/pipeline/hotel-payment-options/02-research.md`  
**Reused contract:** `docs/pipeline/hotel-payment-timing/03-design.md`  
**Downstream:** `UI-HOTEL-PAYMENT-OPTIONS-01`

This is an implementation-ready extension of the existing payment-timing design. Every visible string is
final. There are no placeholders or TODOs. This spec does not create a second timing vocabulary, selector,
filter, sort, ranking input, or Deal Score input.

---

## 0. Outcome and governing decision

Build one combined disclosure named **`How and when you pay`**. It answers, in this order:

1. whether the same provider room/rate has one documented payment path, a genuine choice, or no reliable
   option count;
2. when the stay price is charged, using `HotelPaymentTimingStatement` and the existing timing formatter;
3. who collects the stay price;
4. which methods are explicitly accepted **for the stay price** for that option; and
5. which provider, room/rate scope, and freshness the evidence covers.

The existing payment-timing model remains the only source of charge-event truth. Its collapsed-card clauses,
date formatting, `cardRequiredAtBooking`, `explicit_none`, cross-references, and degradation rules remain
binding. The combined component composes those values; it never introduces `payNow`, `payLater`, or a second
`payAtProperty` flag.

### 0.1 Resolution of the heading change permitted by research

The expanded heading changes from `When you are charged` to `How and when you pay`, and its toggle changes
from `When am I charged?` to `How and when do I pay?`. All timing status lines and bodies continue to resolve
from `lib/hotels/paymentTiming.ts` without alteration. This is one renamed container around the same timing
system, not competing copy.

### 0.2 Today’s honest product state

The wired saved-deal and Hotellook paths cannot supply option plurality, stay-payment methods, or rate match.
Therefore the production default is **provider unsupported + selected-rate unknown**. It must never render as
one option, no option, pay at property, a rejected card, or a property limitation.

---

## 1. Information architecture and hierarchy

### 1.1 Decision hierarchy inside the disclosure

The order is fixed across expanded `HotelCard`, booking review, and research fixtures:

1. **Option-set status** — one path / `{n}` genuine choices / partial / conflicting / unsupported / unknown
2. **Each valid option** — existing timing status → collector → card required at booking → stay-price methods
3. **Evidence boundary** — rate scope → source and checked date
4. **Separation guidance** — guarantee card, deposits/holds, cancellation/refundability, and price coverage
5. **Handoff** — where the traveler confirms final terms

The option-set status is primary inside the panel. Timing, collector, and stay methods are secondary and have
equal weight within each sibling option. Scope, provenance, and cross-references are tertiary.

### 1.2 Hierarchy relative to the surrounding product

| Surface | Primary | Secondary | Tertiary |
|---|---|---|---|
| Saved-deal results | Nightly price | Deal Score and property identity | One dataset-level payment coverage explanation |
| Saved-deal handoff | Provider actions | Unresolved rate-selection requirements | Source limitation |
| Collapsed rich `HotelCard` | Nightly price | Deal Score and existing rate-terms row | `2 ways to pay` supplement only when plurality is complete |
| Expanded `HotelCard` | Price and Deal Score | Combined payment disclosure | Scope, source, freshness |
| Booking review | Selected price and rate | Combined payment disclosure | Provenance and cross-references |

Payment option evidence never changes price prominence or the Deal Score. No payment method is rendered as
more desirable than another.

### 1.3 Surface placement

#### Saved-deal result set (`DealFeed`)

Render one static coverage note after `HotelResultStatus` and before any loading skeleton, error, empty state,
or deal grid. Do not render it inside `DealCard`, `LockedDealCard`, or every skeleton.

It renders whenever the hotel results section has reached a settled or retained-results state and at least
one saved deal is visible. It remains visible while retained cards are dimmed during a filter refresh. It does
not render on initial loading, fatal error with no retained results, or a confirmed-empty state.

#### Saved-deal detail/provider handoff

Render the saved-price fallback inside `HotelDealCriteriaHandoff`, after its current stay/date context and
immediately before `CompareRow`. It applies to the saved price as a whole; it must not be repeated under each
provider button. It must say that providers can differ, because Expedia, Booking, Kiwi, and Trip.com actions
do not represent payment choices for one fixed rate.

If a future integration supplies evidence for exactly one provider action, place the disclosure inside that
provider’s block, directly before its action. Never float provider-specific evidence above the complete
`CompareRow`.

#### Rich `HotelCard` and booking review

Replace the expanded timing panel with the combined component at the same existing position: after `Price
scope`, before `HotelFundsPolicyPanel`. On booking review, place it in the price/evidence sequence after Deal
Score and before the funds-policy panel. Do not render a separate stay-method panel.

The collapsed card keeps the merged rate-terms row from the timing spec. Append ` · 2 ways to pay` only for a
complete compatible option set with two or more options. Do not append method names, `1 payment path`,
partial, unsupported, unknown, conflicting, loading, or error option-set copy to the collapsed row.

---

## 2. Combined evidence contract

DEV owns final TypeScript naming, but the following shape and invariants are normative:

```ts
export type HotelPaymentOptionSetState =
  | 'complete'
  | 'partial'
  | 'not_returned'
  | 'conflicting'
  | 'unsupported'

export type HotelStayPaymentMethodCategory =
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'digital_wallet'
  | 'bank_transfer'
  | 'other'

export interface HotelStayPaymentMethod {
  category: HotelStayPaymentMethodCategory
  /** Provider-returned network/name. Never inferred. */
  label?: string
}

export interface HotelStayPaymentMethodEvidence {
  state: 'complete' | 'partial' | 'not_returned' | 'conflicting'
  accepted: readonly HotelStayPaymentMethod[]
  notAccepted?: readonly HotelStayPaymentMethod[]
  purpose: 'stay_price'
  collector?: HotelChargeCollector
  providerWording?: string
  missingFields?: readonly HotelStayPaymentMethodMissingField[]
}

export interface HotelStayPaymentOption {
  optionId: string
  timing: HotelPaymentTimingStatement
  methods: HotelStayPaymentMethodEvidence
}

export interface HotelPaymentOptionSet {
  state: HotelPaymentOptionSetState
  options: readonly HotelStayPaymentOption[]
  sourceLabel: string
  scope: HotelFundsEvidenceScope
  fetchedAt?: string
  missingFields?: readonly HotelPaymentOptionMissingField[]
}

export interface HotelPaymentOptionCapability {
  optionPlurality: boolean
  stayPaymentMethods: boolean
  exhaustiveMethodSet: boolean
  rateScoped: boolean
}
```

`HotelPaymentTimingEvidence` gains `optionSet?: HotelPaymentOptionSet` and
`optionCapability?: HotelPaymentOptionCapability`. This is an additive child of timing evidence. Do not add a
separate top-level policy panel with its own timing state.

Repeated options, method arrays, provider wording, and conflicts always use the existing reference-backed
hotel context. They are never flattened into query parameters. If reference storage or resolution fails,
render the `error` load state; never silently drop purpose, collector, or scope.

### 2.1 Option-set invariants

1. A genuine choice requires `options.length >= 2`, `optionPlurality: true`, and a match on provider, room,
   rate family, dates, occupancy, currency/price context, and evidence source.
2. A known single path requires `options.length === 1`, the same complete context match, and
   `optionPlurality: true`. A provider unable to report plurality cannot prove that one is the only path.
3. Each option reuses an existing `HotelPaymentTimingStatement`. Timing may not be inferred from method
   evidence, refundability, deposits/holds, partner hostname, or common provider behavior.
4. Method evidence always has `purpose: 'stay_price'`; guarantee, deposit, authorization, cancellation, and
   no-show methods are excluded.
5. The method collector must equal the timing collector. A property method cannot validate a booking-partner
   collected option, and vice versa.
6. Property- or room-scoped method evidence cannot be promoted to a rate-scoped answer. It degrades to
   `partial` with `rate_scope` missing.
7. Different provider links, room ids, rate ids, dates, occupancies, price contexts, or collectors are not
   merged into one option set.
8. `accepted: []` never means rejected. A method is `No` only when explicitly present in `notAccepted`, or
   absent from a source-guaranteed exhaustive set.
9. Provider source order is preserved. The client does not sort options or methods by presumed preference.
10. Normalization returns `Result<T>` and never throws to its caller.

### 2.2 Degradation precedence

Apply in this order, always toward less certainty:

1. **Provenance/context mismatch:** whole option set becomes `not_returned`; discard unmatched facts.
2. **Capability unsupported:** if either plurality or stay-method capability is false, state is
   `unsupported`; never known single/choice.
3. **Conflicting claims:** two or more retained same-context statements that disagree become `conflicting`;
   never count them as options.
4. **Scope/purpose/collector mismatch:** retain only safe facts; state becomes `partial`, with missing fields.
5. **Incomplete option:** missing timing, collector, accepted methods, exhaustive status where required, rate
   scope, or source makes the set `partial`.
6. **Capable omission:** capability is present but no scoped evidence was returned → `not_returned`.
7. **Absent field:** `optionSet === undefined` plus all-false Hotellook capability → `unsupported`; absent
   evidence from a capable adapter → `not_returned`.
8. **Fetch/validation failure:** component load state `error`, not an evidence state.

`explicit_none` remains a timing-only state. It means nothing is collected and no card is charged before
arrival; it never means no stay-payment method exists.

---

## 3. Final copy system

All strings below resolve from `lib/hotels/paymentTiming.ts`, extended as the single combined lexicon. No
component inlines them. `{Provider}` is `sourceLabel`; `{Partner}` is the handoff destination. A partner label
may tell the traveler where to confirm, but must never populate `collector`.

### 3.1 Shared headings and controls

| Element | Final copy |
|---|---|
| Combined panel heading | `How and when you pay` |
| Disclosure toggle | `How and when do I pay?` |
| Methods label | `Accepted for the stay price` |
| Conflicts sub-heading | `Provider statements` |
| Conflict attribution | `Statement {n} — {sourceLabel}` |
| Collapsed plurality supplement | `{n} ways to pay` |
| Prototype disclaimer | `Research prototype — this information is not part of hotel ranking or Deal Score.` |

### 3.2 Result-set coverage note

**Heading:** `Payment options appear after room selection`

**Body:** `These saved prices do not include rate-level payment timing or accepted methods. Check both after choosing a room and rate with a provider.`

This is explanatory content, not an alert or live region.

### 3.3 Saved-price handoff fallback

**Heading:** `Payment options not available from this saved price`

**Body:** `expaify does not have rate-level payment timing or accepted methods for this saved price. Each provider may show different rooms, rates, and payment terms. After choosing a room and rate, confirm when the stay price is charged and whether your payment method is accepted.`

### 3.4 Option-set state copy

| Display state | Status | Body |
|---|---|---|
| Loading | `Checking payment options…` | `We are checking the payment options stated for this room and rate.` |
| Known single | `1 payment path stated for this rate` | `{Provider} stated one payment path for this room and rate. Confirm it is still available before you book.` |
| Known choice | `{n} ways to pay for this rate` | `{Provider} stated {n} payment paths for the same room and rate. Choose your option with {partner}.` |
| Partial | `Payment options partly stated` | `{Provider} stated some payment details. Not stated: {missing fields}. Confirm them for your selected room and rate with {partner}.` |
| Conflicting | `Payment details conflict` | `Statements from {Provider} disagree. expaify is showing them without choosing one. Confirm the payment terms with {partner}.` |
| Unsupported | `Payment options not available from expaify` | `{Provider} cannot supply rate-level payment timing and accepted methods to expaify. This does not mean the property has no payment options. Confirm both after choosing a room and rate with {partner}.` |
| Unknown / not returned | `Payment options not stated for this rate` | `{Provider} did not state the payment options for this room and rate. This is not the same as paying at the property or your method being accepted. Confirm both with {partner}.` |
| Error | `Payment options could not be checked` | `Payment options could not be checked. This does not mean paying at the property is available or your method is accepted. Confirm both with {partner}.` |

Use `booking partner` in lowercase when `{partner}` is unresolved. Do not interpolate a hostname.

### 3.5 Missing-field copy and fixed order

| Field | Phrase |
|---|---|
| `option_plurality` | `whether this rate has another payment path` |
| `timing` | `when the stay price is charged` |
| `collector` | `who collects it` |
| `accepted_methods` | `which methods can pay the stay price` |
| `method_purpose` | `what the payment method is used for` |
| `rate_scope` | `which room and rate this applies to` |
| `source` | `which source stated this` |

Join with the existing `joinList` grammar: `a and b`; `a, b, and c`. Deduplicate before rendering. Do not
list all fields in `unsupported` or `not_returned`; their bodies already explain the boundary.

### 3.6 One valid option row

Render in this fixed order:

1. Timing status from the existing timing formatter: `Charged at booking`, `Charged at the property`, or
   `Charged {Month D, YYYY}`.
2. Collector: `{Partner} collects the stay price.` or `The property collects the stay price.`
3. Card-now fact, when stated: `A card is required at booking.`
4. Method label and values.
5. A separation sentence when the booking card and stay-price evidence do not answer the same question.

Method list copy:

| Evidence | Final copy |
|---|---|
| Explicit categories/networks | `Accepted for the stay price: {joined method names}.` |
| Partial list | `Accepted for the stay price: {joined method names}. Other accepted methods were not stated.` |
| No accepted-method evidence | `Accepted methods for the stay price were not stated.` |
| Conflicting methods | `Statements about accepted methods conflict.` |

Use provider-returned labels after trimming and bounding them. Otherwise use these category names:
`Credit card`, `Debit card`, `Cash`, `Digital wallet`, `Bank transfer`, `Other method`. Deduplicate
case-insensitively, preserve source order, and join as `Visa and Mastercard` / `Cash, Visa, and Mastercard`.
Do not add card logos without the same text label.

### 3.7 Required separation copy

| Condition | Final copy |
|---|---|
| Card required now; stay methods unknown | `A card is required to secure this booking. The provider did not state whether that card can pay the stay price.` |
| Pay-at-property; returned methods are guarantee-only | `These methods secure the reservation. The property’s accepted methods for the stay price were not stated.` |
| Stay methods known; deposit/hold panel also present | `Deposits and card holds are separate from methods accepted for the stay price.` |
| Non-refundable rate | `Non-refundable describes whether you can get money back, not when or how the stay price is paid.` |
| Booking-review surface | `expaify does not collect payment. Confirm the final payment option with {partner}.` |

The first two sentences replace the generic method line; do not show a guarantee method under `Accepted for
the stay price`.

### 3.8 Scope and provenance

| Scope | Final copy |
|---|---|
| `rate` | `This applies to the rate shown.` |
| `room` | `This applies to the room shown, not to a specific rate.` |
| `property` | `This applies to the property, not to a specific room or rate.` |
| `selected_stay` | `This applies to your selected stay.` |
| `not_returned` | `{Provider} did not state which room or rate this applies to.` |

Valid `fetchedAt`: `Stated by {Provider}, checked {Mon D, YYYY}.` Invalid/absent `fetchedAt`: omit the line.
Dates use `Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })`.

### 3.9 Handoff enumeration — exact replacement everywhere

Visible and accessible copies in `HotelDealCriteriaHandoff`, `CompareRow`, expanded `HotelCard`, and
`BookingFlow` use:

`The provider confirms room details, live availability, final total, taxes and fees, payment timing and accepted methods, cancellation policy, and terms.`

Where the subject is already `Provider`, use:

`Provider confirms final total, taxes, fees, payment timing and accepted methods, room availability, cancellation policy, and terms.`

Do not say the provider “accepts” a method before room/rate selection; it only confirms the answer downstream.

### 3.10 Expected-method answer helper

For future traveler preference surfaces, `getStayPaymentMethodAnswer()` returns exactly:

- `Yes — {method} is stated for the stay price.` only for an explicit accepted match with matching purpose,
  collector, provider, and rate scope.
- `No — {method} is not accepted for the stay price.` only for explicit `notAccepted` evidence or absence
  from a contract-guaranteed exhaustive complete set.
- `Not stated — confirm whether {method} can pay the stay price.` for every other case.

This ticket does not add a method preference input. The helper and fixture validation prevent a future UI
from collapsing unknown into no.

---

## 4. Component specification

### 4.1 Public surface

```tsx
// app/components/HotelPaymentTimingPanel.tsx — extended, not duplicated
type Props = {
  evidence: HotelPaymentTimingEvidence | undefined
  loadState?: 'loading' | 'ready' | 'error'
  surface: 'hotel_card' | 'hotel_detail' | 'book_handoff'
  sourceLabel: string
  partner: { label: string; named: boolean }
  fundsPolicyState: HotelFundsPolicyState | 'error'
  showNonRefundableCrossReference: boolean
  offerId: string
  provider: string
  initiallyExpanded?: boolean
  rootRef?: Ref<HTMLElement>
  onOpen?: () => void
}
```

The component keeps its filename to avoid a second implementation. Its exported display name may become
`HotelPaymentDisclosure`, but existing exports and props remain supported. Pure helpers remain in
`lib/hotels/paymentTiming.ts`:

```ts
getHotelPaymentTimingClause(...): string
getHotelPaymentOptionSupplement(...): string | undefined
getHotelPaymentDisclosureCopy(...): HotelPaymentDisclosureCopy
getStayPaymentMethodAnswer(...): 'yes' | 'no' | 'not_stated'
normalizeHotelPaymentOptionSet(...): Result<HotelPaymentOptionSet>
```

### 4.2 Full disclosure DOM order

```text
button “How and when do I pay?” [aria-expanded, aria-controls]
└─ section [aria-labelledby]
   h3 “How and when you pay”
   p option-set status
   p option-set body
   ol aria-label="Payment paths"                 known single/choice only
      li option
         h4 existing timing status
         p collector
         p card-now fact or separation copy
         p “Accepted for the stay price: …”
   div “Provider statements”                     conflicting only
      article per equally weighted statement
   p known facts + missing-fields sentence       partial only
   p scope
   p separation/cross-reference sentences
   p provenance, when valid
```

Use `<ol>` for one or more documented paths and ordinary `<li>` rows. They are not radio buttons, disabled
controls, tabs, or cards with click handlers. expaify does not own selection.

### 4.3 Container and row class patterns

Only existing tokens from `app/globals.css` are permitted.

| State | Container classes |
|---|---|
| Loading, complete | `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-5` |
| Partial, unknown, unsupported, conflicting | `rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3.5 sm:p-5` |
| Error | `rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--error-soft)] p-3.5 sm:p-5` |

Option list: `mt-4 space-y-3`. Each option row:

`rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] p-3.5`

Status/option headings: `text-sm font-medium leading-5 text-[color:var(--text-1)]`. Body and facts:
`mt-1 text-sm leading-6 text-[color:var(--text-2)]`. Tertiary provenance:
`mt-3 text-xs leading-5 text-[color:var(--text-3)]`.

No option gets `--brand-soft`, `--warning`, an icon, a check mark, stronger border, different order, or
different weight. Known-choice rows must look equal.

Disclosure button:

```tsx
<button
  type="button"
  aria-expanded={open}
  aria-controls={panelId}
  className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] py-2 text-left text-sm font-medium leading-6 text-[color:var(--brand)] hover:text-[color:var(--brand-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
>
  <span>How and when do I pay?</span>
  {/* existing decorative chevron; aria-hidden, focusable=false */}
</button>
```

`panelId = hotel-payment-${surface}-${sluggedOfferId}` and must be unique per offer and surface.

### 4.4 Result-set note classes

```tsx
<aside
  aria-labelledby="hotel-payment-coverage-title"
  className="mb-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3"
>
  <h4 id="hotel-payment-coverage-title" className="text-sm font-medium text-[color:var(--text-1)]">
    Payment options appear after room selection
  </h4>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">…</p>
</aside>
```

No `role="alert"`, icon, dismiss action, or per-card duplication.

### 4.5 Saved-price fallback classes

```tsx
<section
  aria-labelledby="saved-price-payment-options-title"
  className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3.5"
>
  <h3 id="saved-price-payment-options-title" className="text-sm font-medium text-[color:var(--text-1)]">
    Payment options not available from this saved price
  </h3>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">…</p>
</section>
```

Settled unsupported content is not a live region.

---

## 5. Every state and interaction

### 5.1 Default / collapsed

The combined disclosure is closed by default on expanded card and booking review. The existing collapsed
timing clause still communicates timing evidence. Only a complete genuine choice adds `{n} ways to pay`.
Click/tap, `Enter`, or `Space` on the native button toggles the panel. Focus stays on the button; it does not
jump into the panel.

### 5.2 Loading

Status/body use §3.4, followed by two non-semantic skeleton lines:

```tsx
<div className="mt-4 space-y-3" aria-hidden="true">
  <div className="skeleton h-3 w-2/3 rounded-full" />
  <div className="skeleton h-3 w-full rounded-full" />
</div>
```

The container uses `role="status" aria-live="polite" aria-busy="true"`. No option count, timing claim,
method name, scope, or cross-reference renders while loading.

### 5.3 Known single

Render the known-single status/body and one list row. Its existing timing status is the row heading. Show
collector, card-now evidence, methods, rate scope, and provenance. `1 payment path` describes only the named
source and rate; it never becomes `only way to pay`.

### 5.4 Known choice

Render `{n} ways to pay for this rate`, then every compatible option as an equal sibling in source order.
There is no selected, recommended, cheapest, default, or hidden “more” option. The handoff button remains the
only action and reads `Check rooms at {Partner}`.

### 5.5 Partial

Render every safe known fact once, followed by the ordered missing-fields sentence. An incomplete option is
not included in the valid-option `<ol>` if its timing-method combination cannot be established. If one valid
option and one incomplete candidate remain, the status is partial—not `2 ways to pay` and not known single.

### 5.6 Empty / unknown

There is no separate visual empty state. A capable provider returning no scoped evidence is `not_returned`
with the exact unknown copy in §3.4. Render no option rows and no empty-method list. This state is not a live
region.

### 5.7 Unsupported

Use the unsupported copy in §3.4. Render no option rows and no method chips. The text describes expaify/source
capability, never the property’s capability. This is the current Hotellook and saved-deal state.

### 5.8 Conflicting

Render the conflict status/body, then `Provider statements`. Each retained statement is an `<article>` with
`Statement {n} — {sourceLabel}` and its bounded provider wording or structured facts. All statements use the
same type, border, background, and order. Do not use option-list semantics, choice language, radio controls,
or a “likely” marker.

### 5.9 Error and retry

Render the error copy in §3.4 with `role="status" aria-live="polite"`. Show a `Retry` button only when the
caller supplies a real `onRetry` that reissues the failed check. Button copy is `Retry`; pending copy is
`Retrying…`, with `disabled` and `aria-disabled="true"`. On a failed retry, keep the error visible and move
focus to the error status heading. Without `onRetry`, show confirmation guidance only—never a dead control.

### 5.10 Provider handoff

Activation opens the existing attributed provider deeplink in a new tab; it does not select an option or
commit payment. The composed accessible name adds, before `Opens in a new tab`:

`Confirm payment timing and accepted methods for your selected room and rate.`

All outbound links retain existing affiliate markers and `rel="noopener noreferrer sponsored"`.

### 5.11 Edge cases

- Two options from different providers/rates/occupancies → partial or separate provider-specific evidence,
  never choice.
- Duplicate options after normalization → one option; option count uses normalized rows.
- More than two options → show all; count is numeric and source order is retained.
- One known option plus one conflicting statement → conflicting; do not cherry-pick the known option.
- Timing complete, methods unknown → partial; timing remains visible.
- Methods known, timing unknown → partial; methods remain visible but no valid option row is claimed.
- Guarantee Visa, property methods absent → `Visa` is not shown under stay-price methods.
- Property says cash accepted, no rate match → partial with rate scope missing; no “cash accepted for this
  rate.”
- Complete Visa/Mastercard exhaustive set, traveler asks about Amex → `No`; non-exhaustive set → `Not stated`.
- Invalid/blank provider method label → fall back to category name; control characters are stripped and
  rendered text is capped at 80 characters.
- Invalid `fetchedAt` or deferred date → omit/degrade per the timing spec; never show an unvalidated date.
- Invalid/missing price → no collapsed timing or payment disclosure, matching the timing spec.
- Missing provider link → keep evidence readable but use the existing `Provider link unavailable` state; do
  not offer retry as if it could restore a deeplink.

---

## 6. Responsive behaviour

### 6.1 Mobile — 375px

- One column; the result-set note, saved-price fallback, disclosure, and all option rows are full width.
- Panel padding is `p-3.5`; option rows use `p-3.5`; vertical gap is `space-y-3`.
- Timing, collector, methods, source wording, and fallback bodies wrap without line clamp.
- Use `min-w-0 break-words [overflow-wrap:anywhere]` on provider and returned-method labels.
- Method names are plain wrapped text, not horizontal chips or a carousel.
- The disclosure, retry, and provider actions are at least 44px high (`min-h-11`).
- Known-choice rows remain stacked; do not place two options side-by-side.
- The nightly amount remains unwrapped and unobstructed; no payment copy enters its grid row.

### 6.2 Desktop — 1280px

- The combined panel stays in the existing single-column evidence stack. It does not become a side panel or
  a third comparison column.
- Panel padding becomes `sm:p-5`; saved handoff section remains `sm:p-6` at its outer container.
- Option rows remain one per row so timing-method associations are not read across columns.
- `CompareRow` may retain its current two-column provider layout, but payment evidence associated with one
  provider stays inside that provider’s column.

TEST must inspect 375px and 1280px with the longest unknown copy, three options, a long provider label, and
three method labels. There must be no horizontal scrolling, overlap, clipped decision text, or displaced CTA.

---

## 7. Accessibility and keyboard

1. Toggle is a native button with `aria-expanded`, `aria-controls`, a unique panel id, and visible
   `focus-visible:shadow-[var(--focus-ring)]`.
2. `Enter` and `Space` use native activation. Focus stays on toggle; the revealed panel is next in DOM order.
3. Option paths are a semantic ordered list, never disabled radio buttons. The list label is `Payment paths`.
4. Method names are text. Logos, if later added, are `aria-hidden` duplicates only.
5. Status is never color-only. All state distinctions appear in authored text.
6. Only loading and newly surfaced error use `role="status"`/`aria-live="polite"`; settled partial,
   unsupported, unknown, and conflicting states do not interrupt scanning.
7. Skeletons are `aria-hidden`; loading text supplies the accessible state.
8. Conflict statements use headings and articles, not controls, so a screen-reader user cannot mistake them
   for available choices.
9. Saved result coverage uses an `aside` with a heading and is reached in reading order before cards.
10. Visible payment guidance mirrors the handoff accessible name; the accessible name is not the only place
    unresolved payment terms are disclosed.
11. Tab order at review is price/Deal Score → disclosure toggle → optional retry → funds-policy controls →
    provider handoff. No non-interactive option row enters the tab order.
12. Chevron is `aria-hidden="true" focusable="false"` and uses `motion-reduce:transition-none`.

---

## 8. Prototype and fixtures

Extend the payment-timing prototype instead of creating an unrelated harness. Use URL parameter
`paymentFixture` with an allowlist parser defaulting to `control`, the existing research-origin guard, fixed
disclaimer, and `track()` conventions. No production provider reads fixtures.

| Fixture | Required render |
|---|---|
| `payment-prepay-cards` | Known single; charged at booking; partner collects; Visa and Mastercard accepted for stay price |
| `payment-property-guarantee` | Partial; at property; card required to secure; property stay methods not returned |
| `payment-same-rate-choice` | Known choice; prepay and at-property sibling rows with different method sets |
| `payment-partial-methods` | Timing known; accepted methods not returned |
| `payment-not-returned` | Capable provider; unknown copy |
| `payment-unsupported` | All-false Hotellook capability; unsupported copy |
| `payment-conflicting` | Two disagreeing same-rate statements shown as statements, not options |
| `payment-property-cash-no-rate` | Property-level cash evidence; partial with rate scope missing |
| `payment-wrong-provider` | Evidence discarded; unknown/not returned |
| `payment-loading` | Loading copy and skeleton |
| `payment-error-retry` | Error copy with working retry state |

Comprehension questions, in fixed order, each offering `The provider did not say`:

1. `How many payment paths does this same room and rate offer?`
2. `Can you pay the stay price at the property?`
3. `Can you use {assigned method} to pay the stay price?`
4. `Who collects the stay payment?`
5. `Is a card required now only to secure the booking?`

Ship gate: zero false-comfort errors on unsupported/not-returned fixtures, zero guarantee-purpose errors, and
zero false-choice errors on conflicting/different-provider fixtures.

---

## 9. Analytics boundaries

Extend the timing analytics dimensions; do not create a causal “payment abandonment” metric.

Events:

- `hotel_payment_disclosure_viewed` — ≥50% visible for ≥1 second, once per offer/provider/surface;
- `hotel_payment_disclosure_opened` — first closed → open, once per offer/provider/surface;
- existing provider handoff event gains normalized evidence dimensions; and
- booking-review return prompt may add final option `Payment timing or method did not match` only when the
  return control is otherwise being edited by UI.

Dimensions: `optionSetState`, `optionCountBucket` (`0 | 1 | 2 | 3_plus | unknown`), `timingState`,
`methodEvidenceState`, `collector`, `scope`, `provider`, and `surface`. Never emit raw provider wording,
method labels, card networks, dates, offer ids beyond the existing bounded hash, or a traveler’s expected
method. Dwell, abandonment, or a quick return without an explicit answer is not attributed to payment.

---

## 10. UI / DEV ownership and sequencing

### UI stage

- extend the existing timing disclosure component into the combined hierarchy;
- add the result-set coverage note and saved-price handoff fallback;
- add equal option-row and conflict-statement rendering for fixtures;
- amend all visible and accessible handoff enumerations;
- preserve the collapsed timing row, adding plurality only for complete known choice;
- implement responsive, focus, live-region, and retry presentation; and
- add component/copy/fixture tests.

UI must preserve existing component props and exports. It may use fixture-owned typed data while the provider
contract is absent, but production `undefined` evidence must render the honest unsupported state.

### DEV stage

- add the option/method/capability types to `lib/types.ts` as an additive timing child;
- implement `Result<T>` normalization and degradation rules;
- add all-false Hotellook capability on both normalization paths;
- transport repeated arrays only through the existing reference-backed booking context;
- preserve integer-money and provider-adapter contracts; and
- expose normalized analytics dimensions without raw method data.

The UI ticket must create `DEV-HOTEL-PAYMENT-OPTIONS-01`; DEV then creates the TEST ticket. A provider
integration is not part of either stage.

---

## 11. Acceptance criteria

### Copy and inference

1. One combined panel is titled `How and when you pay`; no separate stay-method or second timing panel exists.
2. All timing sentences resolve from the existing timing lexicon/formatter.
3. Unknown contains `This is not the same as paying at the property or your method being accepted.`
4. Unsupported contains `This does not mean the property has no payment options.`
5. Guarantee/deposit/hold methods never render below `Accepted for the stay price`.
6. `accepted: []` without exhaustive or explicit rejection evidence never renders `No` or `not accepted`.
7. Every provider-confirmation enumeration includes `payment timing and accepted methods` visibly and in
   accessible names.

### State logic

8. Same-context 2+ complete options → known choice; source order preserved.
9. Different providers/rates/occupancies → never known choice.
10. One option from a plurality-unsupported adapter → unsupported, never known single.
11. Conflicting statements use statement semantics and never render `{n} ways to pay`.
12. Timing-known/methods-unknown and methods-known/timing-unknown both render partial.
13. Property-scoped method evidence never becomes rate-scoped acceptance.
14. Missing evidence from a capable provider → unknown; all-false capability → unsupported; fetch failure →
    error.
15. No normalization path throws.

### Rendering and interaction

16. Current saved-deal results show one coverage note, not one warning per card.
17. Saved-deal handoff fallback renders directly before `CompareRow`.
18. Known choice renders all options equally as non-interactive list rows.
19. Retry renders only with a real retry callback; pending/error focus behavior matches §5.9.
20. Loading, known single, known choice, partial, unknown, unsupported, conflicting, and error are visually
    and textually distinct.
21. No method option affects sorting, filtering, price, or Deal Score.

### Accessibility and responsive

22. Toggle, ids, focus ring, list semantics, live-region restrictions, and tab order satisfy §7.
23. Method evidence is always text; no logo-only meaning.
24. Provider actions remain at least 44px high and retain affiliate/sponsored link attributes.
25. At 375px and 1280px, the longest fallbacks and three-option fixture have no overflow, overlap, clamp, or
    displaced price/CTA.
26. `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` exit 0.

---

## 12. Out of scope

- Live Booking.com/Expedia payment-option integration or scraping provider pages.
- Capturing occupancy, room, or rate identity in the saved-deal path.
- A payment-method preference control, filter, sort, selector, or recommendation.
- Checkout, card collection, authentication, wallet support, currency settlement, or payment execution.
- Deposits, holds, cancellation/no-show penalties, refundability, and total-price scope; those remain in their
  existing evidence systems and are only cross-referenced here.
- Consolidating the saved-deal and rich `HotelCard` journeys.
- Treating different OTA links as equivalent ways to pay.

---

**Quality bar check:** the spec defines final copy and class patterns for default, loading, known single,
known choice, partial, unknown, unsupported, conflicting, and error states; mobile 375px and desktop 1280px;
keyboard, focus, screen-reader and retry behavior; rate scope, collector, method purpose, source/freshness,
and edge-case degradation. It preserves the existing timing model and does not fabricate currently absent
payment evidence.

**Handoff:** `UI-HOTEL-PAYMENT-OPTIONS-01`, carrying this path and
`docs/pipeline/hotel-payment-timing/03-design.md`. UI must create `DEV-HOTEL-PAYMENT-OPTIONS-01` for the data
contract and normalization work described in §10.
