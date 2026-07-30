# UXDES-HOTEL-POLICY-EXCEPTIONS-01: Hotel Policy Exception Visibility — Design Spec

Date: 2026-07-30
Stage: UX Design (UXDES)
Persona: Senior UX Designer / Interaction Designer
Priority: P1
Feature slug: `hotel-policy-exceptions`
Upstream: `01-discovery.md`, `02-research.md` (5 binding directives)
Downstream: `UI-HOTEL-POLICY-EXCEPTIONS-01`

---

## 0. What this spec commits to

One new property-scoped evidence type, one new normalizer, one new component with two variants, and two analytics events. **Zero changes to `lib/hotels/rateEligibility.ts`, `app/components/HotelRateRestrictions.tsx`, or any `rate-eligibility` type.**

The primary designed state is `not_provided` — the state of 100% of offers on the day this ships. It is designed first (§4), and every other state is designed relative to it.

**Hierarchy commitment.** On every surface, this panel sits *below* price, Deal Score, and location and *above* the handoff CTA. It is never the first thing read and never the last.

---

## 1. Type shape (Directives 1 and 2)

Added to `lib/types.ts`, after `HotelRateEligibilityCapability` (line 472) and before `HotelOffer`. No existing type is modified except `HotelOffer`, which gains two optional fields.

```ts
/** Property admission: may you OCCUPY. Distinct from rate eligibility: may you BOOK this rate. */
export type HotelAdmissionFamily =
  | 'checkin_age'
  | 'checkin_identity'
  | 'local_guest_restriction'
  | 'occupancy_admission';

export type HotelAdmissionLoadState = 'loading' | 'ready' | 'error';

/** Verbatim supplier prose. Never parsed into flags, numbers, or headcounts. */
export interface SupplierAdmissionStatement {
  id: string;
  sourceLabel: string;
  /** Supplier text, reproduced exactly. Bounded 1–300 chars after trim. */
  sourceText: string;
  observedAt?: string;
}

export interface HotelAdmissionStatementEvidence {
  state: HotelDocumentStatus;
  statements: SupplierAdmissionStatement[];
}

export interface HotelAdmissionAgeEvidence extends HotelAdmissionStatementEvidence {
  /** The only typed value in the taxonomy. Non-negative integer. No maximum. No range. */
  minimumAge?: number;
}

export interface HotelAdmissionPolicyEvidence {
  /** Literal. There is no rate-scoped variant of this type. */
  scope: 'property';
  /** Must match the rendered offer's id; mismatch degrades every family to not_provided. */
  propertyId: string;
  /** Must match HotelOffer.source; mismatch degrades every family to not_provided. */
  supplier: string;
  loadState: HotelAdmissionLoadState;
  fetchedAt?: string;
  families: {
    checkin_age: HotelAdmissionAgeEvidence;
    checkin_identity: HotelAdmissionStatementEvidence;
    local_guest_restriction: HotelAdmissionStatementEvidence;
    occupancy_admission: HotelAdmissionStatementEvidence;
  };
}

/** Declares whether an adapter's contract can return an explicit negative for a family. */
export interface HotelAdmissionPolicyCapability {
  checkin_age: boolean;
  checkin_identity: boolean;
  local_guest_restriction: boolean;
  occupancy_admission: boolean;
}
```

On `HotelOffer` (`lib/types.ts:474–495`), append:

```ts
  admissionPolicy?: HotelAdmissionPolicyEvidence;
  admissionPolicyCapability?: HotelAdmissionPolicyCapability;
```

Derived presentation, mirroring `RateEligibilityPresentation` (`lib/types.ts:433–438`):

```ts
export type HotelAdmissionRowState = 'restricted' | 'no_rule_reported' | 'unavailable' | 'conflicting';

export interface HotelAdmissionRow {
  family: HotelAdmissionFamily;
  rowState: HotelAdmissionRowState;
  /** Row label, e.g. 'Minimum check-in age'. */
  label: string;
  /** One finished sentence. Never ends in the rate word 'only'. */
  sentence: string;
  /** Verbatim supplier prose, already bounded and capped. */
  statements: readonly SupplierAdmissionStatement[];
  /** Count of statements dropped by the render cap; 0 when none. */
  omittedStatementCount: number;
}

export type HotelAdmissionPresentation =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'not_provided' }
  | {
      state: 'reported';
      rows: readonly HotelAdmissionRow[];
      /** True when at least one family is not_provided while others reported. */
      coverageIncomplete: boolean;
      /** True when at least one row is rowState 'restricted'. Drives the chip only. */
      hasRestriction: boolean;
      fetchedAt?: string;
    };
```

**Banned members, binding.** No `maxAge`, `adultsOnly`, `photoIdRequired`, `cardInGuestNameRequired`, `localResidentsBarred`, `maxOccupancy`, `sleeps`, or any boolean per-rule flag. No fifth family. No member added to `HotelRateFamilyEvidence`, `HotelRateEligibilityEvidence`, `RateRestrictionFamily`, or `HotelRateEligibilityCapability`.

---

## 2. Normalizer contract — `lib/hotels/admissionPolicy.ts` (new file)

```ts
export const ADMISSION_FAMILY_ORDER: readonly HotelAdmissionFamily[] = [
  'checkin_age',
  'checkin_identity',
  'local_guest_restriction',
  'occupancy_admission',
];

/** No current adapter may declare support without a documented supplier contract behind it. */
export const HOTEL_ADMISSION_POLICY_UNSUPPORTED: HotelAdmissionPolicyCapability = {
  checkin_age: false,
  checkin_identity: false,
  local_guest_restriction: false,
  occupancy_admission: false,
};

export function deriveAdmissionPolicyPresentation(params: {
  propertyId: string;
  supplier: string;
  providerName: string;
  evidence?: HotelAdmissionPolicyEvidence;
  capability?: HotelAdmissionPolicyCapability;
}): HotelAdmissionPresentation;
```

Gate order, executed top to bottom. Each gate that fires ends derivation.

| # | Gate | Result |
|---|---|---|
| 1 | `evidence` absent, `scope !== 'property'`, `evidence.propertyId !== propertyId`, or `evidence.supplier !== supplier` | `{ state: 'not_provided' }` — mirrors `rateEligibility.ts:111–113`. Mismatched evidence is never merged or partially trusted. |
| 2 | `loadState === 'loading'` | `{ state: 'loading' }` |
| 3 | `loadState === 'error'` | `{ state: 'error' }` |
| 4 | Per-family normalization (below) yields zero rows | `{ state: 'not_provided' }` |
| 5 | Otherwise | `{ state: 'reported', rows, coverageIncomplete, hasRestriction, fetchedAt }` |

**Per-family normalization.**

1. A family whose `state` is not one of the five `HotelDocumentStatus` values → `not_provided`.
2. Statements are validated individually: `sourceText` and `sourceLabel` trimmed, non-empty, `sourceText` ≤ 300 chars, `sourceLabel` ≤ 80 chars, `id` non-empty. Invalid statements are dropped, never truncated and never displayed partially.
3. `checkin_age.minimumAge` validated exactly as `validAge` (`rateEligibility.ts:43–47`): integer, `>= 0`, else the family degrades to `not_provided`. **No maximum bound is validated and none is displayed.**
4. **`minimumAge === 0` is a valid number that states no restriction.** It degrades `checkin_age` to `not_provided` rather than rendering "0 or older", which would be nonsense masquerading as a fact.
5. `state: 'confirmed' | 'conditional'` with no `minimumAge` (age family) and no surviving statement → `not_provided`. A restriction with no content is not a restriction.
6. `state: 'confirmed'` with an explicit negative — no `minimumAge`, no statements, and the supplier affirmatively reported "no rule" — is **capability-gated exactly as `clear` is at `rateEligibility.ts:132–137`**: rendered as `no_rule_reported` only when `capability[family] === true`. Absent or `false` capability → `not_provided`. Since both adapters ship `HOTEL_ADMISSION_POLICY_UNSUPPORTED`, this row is unreachable today by construction. It is still fully specified (§5.3) because the type permits it.
7. `state: 'conflicting'` renders `rowState: 'conflicting'` and displays **every** surviving statement, attributed. Statements are never reconciled, ranked, or de-duplicated into one claim.
8. `state: 'unavailable'` renders `rowState: 'unavailable'` — the supplier told us it could not confirm. This is distinct from `not_provided`, where the supplier said nothing at all.
9. `state: 'not_provided'` produces **no row**; it contributes to `coverageIncomplete`.
10. Row order is `ADMISSION_FAMILY_ORDER`. Display order is DOM order. Rows are never re-ordered by severity, recency, or count.
11. Statement render cap: **3 per family**. Surviving statements beyond 3 are counted into `omittedStatementCount` and disclosed in copy (§5.4), never silently dropped.
12. Affirmative restrictions render regardless of capability, mirroring the rate normalizer, which capability-gates only the negative. Capability is a guard against manufactured reassurance, not against reported facts.

**`hasRestriction`** is true only when at least one row is `rowState: 'restricted'`. `conflicting` and `unavailable` do **not** set it, so neither produces a collapsed-card chip.

---

## 3. Copy system — every visible string

`{Provider}` = `providerDisplayName(source)` when `hasProviderName(source)`, else `The booking provider`. `{provider}` is the same value in mid-sentence position, else `the booking provider`. Nothing else is ever substituted; there is no "the property" fallback, because absence of a provider name does not make the property the source.

### 3.1 Heading

| Surface | Element | String |
|---|---|---|
| Booking review, section 3 | `<h3 id="hotel-admission-policy-title">` | `Check-in eligibility` |
| Expanded hotel card | `<p>` block title, block has `role="group"` + `aria-label` | `Check-in eligibility` |

The heading contains neither `Rate` nor `documents` nor `Document readiness`. Enforced by Directive 1.7.

### 3.2 Panel-level `not_provided` — the primary state

Exactly three lines. **One panel-level sentence pair, not four rows.**

```
Check-in eligibility
{Provider} has not told us this property's check-in age, ID, or occupancy rules.
This is not a statement that there are no rules. Confirm with the property or the booking partner before paying.
Source: {Provider}. Check-in eligibility not returned.
```

### 3.3 Panel-level `error`

```
Check-in eligibility
Check-in eligibility could not be checked with {provider}.
This is not a statement that there are no rules. Confirm the check-in age, ID, and occupancy rules with the property before paying.
Source: {Provider}. Check-in eligibility could not be checked.
```

Distinct from `not_provided` in both the body sentence (*could not be checked* vs. *has not told us*) and the provenance sentence, satisfying Directive 3.6.

### 3.4 Panel-level `loading`

```
Check-in eligibility
Checking check-in eligibility…
```

No provenance line while loading (matches `HotelRateRestrictions.tsx:196`).

### 3.5 Row labels

| Family | Label |
|---|---|
| `checkin_age` | `Minimum check-in age` |
| `checkin_identity` | `ID and payment at check-in` |
| `local_guest_restriction` | `Local residents and registration ID` |
| `occupancy_admission` | `Who may occupy the room` |

### 3.6 Row sentences

Every restricted sentence is a **property-subject sentence**. None ends in the rate qualifier `only`. None is `Ages {N}+ only`.

**`checkin_age`**

| Row state | Sentence |
|---|---|
| `restricted`, `confirmed` | `This property requires guests to be {N} or older at check-in.` |
| `restricted`, `conditional` | `This property requires guests to be {N} or older at check-in, with the conditions stated below.` |
| `no_rule_reported` | `{Provider} reports no minimum check-in age for this property.` |
| `unavailable` | `{Provider} could not confirm a minimum check-in age for this property.` |
| `conflicting` | `{Provider} returned conflicting statements about the minimum check-in age. Both are shown below.` |

**`checkin_identity`**

| Row state | Sentence |
|---|---|
| `restricted`, `confirmed` | `This property requires the registering guest to meet the following identification and payment conditions at check-in.` |
| `restricted`, `conditional` | `This property applies the following identification and payment conditions at check-in in some cases.` |
| `no_rule_reported` | `{Provider} reports no identification or payment-name condition at check-in for this property.` |
| `unavailable` | `{Provider} could not confirm what identification or payment the registering guest must present at check-in.` |
| `conflicting` | `{Provider} returned conflicting statements about identification and payment at check-in. Both are shown below.` |

**`local_guest_restriction`**

| Row state | Sentence |
|---|---|
| `restricted`, `confirmed` | `This property applies the following restriction on local residents or registration ID at check-in.` |
| `restricted`, `conditional` | `This property applies the following restriction on local residents or registration ID at check-in in some cases.` |
| `no_rule_reported` | `{Provider} reports no local-resident or registration-ID restriction for this property.` |
| `unavailable` | `{Provider} could not confirm whether this property restricts local residents or requires a specific registration ID.` |
| `conflicting` | `{Provider} returned conflicting statements about local-resident and registration-ID rules. Both are shown below.` |

**`occupancy_admission`**

| Row state | Sentence |
|---|---|
| `restricted`, `confirmed` | `This property applies the following restriction on who may be registered to occupy a room.` |
| `restricted`, `conditional` | `This property applies the following restriction on who may be registered to occupy a room in some cases.` |
| `no_rule_reported` | `{Provider} reports no restriction on who may be registered to occupy a room at this property.` |
| `unavailable` | `{Provider} could not confirm who this property will register to occupy a room.` |
| `conflicting` | `{Provider} returned conflicting statements about who may be registered to occupy a room. Both are shown below.` |

No `occupancy_admission` string states, derives, or displays a headcount, a bed count, a "sleeps N", or a party-size judgement. If a supplier statement contains a number, it appears only inside the verbatim quotation and is never extracted.

### 3.7 Statement attribution

Each rendered statement:

```
“{sourceText}” — {sourceLabel}, observed {absolute}
```

with `{absolute}` from `formatAbsoluteFreshness(validFreshnessDate(observedAt))`. When `observedAt` is missing or invalid:

```
“{sourceText}” — {sourceLabel}, observation date not available
```

### 3.8 Trailing lines

| Condition | String |
|---|---|
| `coverageIncomplete` (mixed state, Directive 3.3) | `{Provider} did not report the other check-in eligibility rules.` |
| `omittedStatementCount > 0` on a row | `{Provider} returned {k} more {statement|statements} for this rule. Check the property's full house rules before paying.` |
| `hasRestriction` (panel footer) | `Confirm you meet these rules before you pay. The property makes the final admission decision at check-in.` |
| `reported`, provenance, valid `fetchedAt` | `Source: {Provider}. Check-in eligibility fetched {absolute}.` |
| `reported`, provenance, no valid `fetchedAt` | `Source: {Provider}. Check-in eligibility freshness not available.` |

The footer names *the property* as the admission decider — deliberately disjoint from the rate panel's *"The booking partner makes the final eligibility decision"* (`HotelRateRestrictions.tsx:200`). Two panels, two deciders, two sentences.

### 3.9 Collapsed-card chip copy

| Case | Chip text | `aria-label` |
|---|---|---|
| One restricted family, `checkin_age` | `Check-in: age {N}+` | `Check-in eligibility: this property requires guests to be {N} or older at check-in.` |
| One restricted family, `checkin_identity` | `Check-in: ID rules` | `Check-in eligibility: this property has reported identification or payment rules at check-in.` |
| One restricted family, `local_guest_restriction` | `Check-in: resident rules` | `Check-in eligibility: this property has reported a local-resident or registration-ID rule.` |
| One restricted family, `occupancy_admission` | `Check-in: occupancy rules` | `Check-in eligibility: this property has reported a restriction on who may occupy a room.` |
| Two or more restricted families | `Check-in: {N} property rules` | `Check-in eligibility: {N} property rules reported. Open details for the full statements.` |

The `Check-in:` prefix is mandatory and is the lexical separator from the adjacent rate chip (`Restrictions not provided`, `Ages 21+ only`). `age {N}+` is deliberately lower-case and prefixed so it can never be read as, or grepped as, `Ages {N}+ only`.

### 3.10 Forbidden copy — binding

None of these strings, in any casing, may appear in any delivered file:

`No age restriction` · `No restrictions` · `Anyone can check in` · `All guests welcome` · `No ID required` · `Open to all` · `No minimum age`

No check-mark glyph, no `--success`, no `--success-soft`, and no `--accent` may attach to any `not_provided`, `unavailable`, or `error` state. Absence is neutral, never positive. The only permitted way to say "no rule" is the attributed, capability-gated `{Provider} reports no …` sentence in §3.6.

---

## 4. Component — `app/components/HotelAdmissionPolicy.tsx` (new file)

Two exports, one shared internal renderer. Nothing is imported from, added to, or rendered inside `HotelRateRestrictions.tsx`.

```tsx
export function HotelAdmissionPolicySection(props: {
  presentation: HotelAdmissionPresentation;
  providerName: string;
}): JSX.Element            // booking review, section 3. Uses h3/h4.

export function HotelAdmissionPolicyCardBlock(props: {
  presentation: HotelAdmissionPresentation;
  providerName: string;
}): JSX.Element            // expanded hotel card. Uses <p> titles + role="group".

export function HotelAdmissionCardChip(props: {
  presentation: HotelAdmissionPresentation;
}): JSX.Element | null     // collapsed hotel card. Returns null unless hasRestriction.

export function getAdmissionAccessibleSummary(
  presentation: HotelAdmissionPresentation,
  providerName: string,
): string                   // one sentence, for card accessible names
```

`HotelAdmissionPolicySection` and `HotelAdmissionPolicyCardBlock` **always render**. Neither returns `null` for any presentation state. Omission-on-unknown (the Google Hotels pattern, research §3.2) is rejected.

`HotelAdmissionCardChip` returns `null` for `not_provided`, `loading`, `error`, and for `reported` with `hasRestriction === false`. This is the only null return in the component.

### 4.1 Review variant DOM

```
<section aria-labelledby="hotel-admission-policy-title" [role/aria-live when loading|error]>
  <h3 id="hotel-admission-policy-title">Check-in eligibility</h3>
  — not_provided/error/loading: <p> body sentence(s)
  — reported: <ul> of rows
        <li>
          <h4>{label}</h4>
          <p>{sentence}</p>
          <ul> <li><p>“{sourceText}” — {sourceLabel}, observed {absolute}</p></li> </ul>
          <p>{omitted-statements line}</p>
        </li>
  <p>{coverageIncomplete line}</p>
  <p>{restriction footer}</p>
  <p>{provenance line}</p>
</section>
```

### 4.2 Card variant DOM

Identical structure with `<section>` → `<div role="group" aria-label="Check-in eligibility">`, `<h3>` → `<p>`, `<h4>` → `<p>`. The expanded card's eleven sibling blocks use no headings (`HotelCard.tsx:1004`, `1045`, `1066`); injecting an `h3` there would break the page's heading outline. The `role="group"` + `aria-label` preserves the landmark for screen readers without inventing a heading level.

---

## 5. State catalogue — visual spec, 375px and 1280px

Tokens are `app/globals.css` only. Layout is single-column at both widths; the only responsive change is padding.

Shared container classes:

| Variant | Class string |
|---|---|
| Review, neutral | `mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 sm:px-5 sm:py-4` |
| Review, restricted | same with `border-[color:var(--border-strong)]` |
| Card, neutral | `min-w-0 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3` |
| Card, restricted | same with `border-[color:var(--border-strong)]` |

Shared text classes:

| Element | Class string |
|---|---|
| Review `h3` | `text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]` |
| Card block title `p` | `font-medium text-[color:var(--text-1)]` |
| Row label (`h4` / `p`) | `text-sm font-medium leading-5 text-[color:var(--text-1)]` (card: `text-xs leading-5`) |
| Row sentence | `mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]` (card: `text-xs leading-5 text-[color:var(--text-2)]`) |
| Statement | `mt-1.5 break-words text-xs leading-5 text-[color:var(--text-2)]` |
| Coverage / omitted line | `mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]` |
| Restriction footer | `mt-3 text-sm leading-6 text-[color:var(--text-2)]` (card: `text-xs leading-5`) |
| Provenance, non-error | `mt-2 break-words text-xs font-medium leading-5 text-[color:var(--text-3)]` |
| Provenance, error | `mt-2 break-words text-xs font-medium leading-5 text-[color:var(--error-text)]` |

Every text container carries `break-words`; every wrapper carries `min-w-0` (pattern: `HotelRateRestrictions.tsx:144–149`). No `whitespace-nowrap`, no fixed widths, no horizontal scroll at 375px.

### 5.1 `not_provided` — primary

Neutral container. Heading + two body sentences (`mt-2 text-sm leading-6 text-[color:var(--text-1)]` for the first, `mt-2 text-sm leading-6 text-[color:var(--text-2)]` for the second) + `--text-3` provenance line. **No rows. No chip. No icon. No success token.**

- 375px review: 4 text lines ≈ 96px including padding.
- 375px card: 4 text lines at `text-xs` ≈ 78px.
- 1280px: identical structure, `sm:` padding, lines wrap less.

### 5.2 `restricted` (one or more families)

Restricted container border (`--border-strong`). No fill tint on the panel — the tint budget on these cards is already spent by the rate chip's `--warning-soft`; a second warning-filled block at 375px reads as an alarm. Emphasis comes from `--border-strong` + `--text-1` sentences.

Row separation: `mt-3 space-y-3` on the `<ul>`, each `<li>` `border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0`.

### 5.3 `no_rule_reported` (capability-gated, unreachable today)

Rendered as an ordinary row with `--text-2` sentence, neutral container. **No check-mark, no `--success`, no `--success-soft`.** The attribution is the entire safety mechanism: the sentence names the provider as the claimant, so a wrong claim is traceable to a source rather than presented as expaify's own assurance.

### 5.4 `conflicting`

Row sentence in `text-[color:var(--warning)] font-medium`; every statement rendered beneath it, each with its own attribution. Never merged. Never counted as a restriction for the chip.

### 5.5 `unavailable`

Row sentence in `--text-2`. Neutral. No chip. Distinct from `not_provided` in copy (§3.6): *could not confirm* vs. no row at all.

### 5.6 `loading`

Container gets `role="status" aria-live="polite" aria-atomic="true"` and `min-h-[4.5rem]` (review) / `min-h-[3.5rem]` (card) so the section-4 CTA does not jump when the state resolves. Heading + `Checking check-in eligibility…` in `--text-2`. Pattern: `HotelRateRestrictions.tsx:163–175`.

### 5.7 `error`

Container gets `role="status" aria-live="polite" aria-atomic="true"`. Body sentences in `--text-1` / `--text-2`; provenance line in `--error-text`. No retry control — this panel has no fetch of its own; it renders what the offer carries.

### 5.8 Collapsed-card chip

```
mt-1.5 inline-flex max-w-full items-center rounded-[var(--radius-control)]
border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]
px-2 py-1 text-xs font-medium leading-4 text-[color:var(--warning)]
```
with `<span className="truncate">{text}</span>` and the `aria-label` from §3.9. Max text length is `Check-in: occupancy rules` (25 chars), which fits on one line at 375px inside the card's content column; `truncate` is belt-and-braces for a long provider-driven `{N}`.

### 5.9 Focus and keyboard

The panel contains **no interactive elements** in any state — no toggle, no link, no retry. Tab order is therefore unchanged on every surface, which is the strongest possible guarantee against regressing the card's existing focus sequence (`Details` toggle → review CTA). If a future ticket adds a disclosure, it inherits the card's existing `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]` pattern; this ticket does not add one.

Heading outline on the booking review: `h1` (page) → `h2 Hotel fit` → `h3 Check-in eligibility` → `h4` row labels. No skipped level. On the card: no new heading at all.

---

## 6. Placement (Directive 4)

### 6.1 Booking review — `app/book/BookingFlow.tsx`, `HotelDecisionSummary`

Insert `<HotelAdmissionPolicySection>` as the **last child of `<section aria-labelledby="hotel-fit-title">`**, after the class/rating `<dl>` (closes at line 380) and after the location-provenance row when present.

Result in DOM order: section 1 property → section 2 price and Deal Score → **section 3 Hotel fit, ending in Check-in eligibility** → section 4 Check rooms with provider (`line 1091`) → section 5 Supporting evidence (`line 1125`, where `HotelRateRestrictionsSection` stays untouched).

`hotel-fit-title`, `hotel-provider-title`, `hotel-supporting-title` and every existing `aria-labelledby` id are unchanged. Sections 1 and 2 are unmoved.

### 6.2 Expanded hotel card — `app/components/HotelCard.tsx`

Insert `<HotelAdmissionPolicyCardBlock>` between the Location block (closes line 1016) and `<ParkingSection>` (line 1018). New DOM order of the expanded stack: Deal Score → Quality evidence → Location → **Check-in eligibility** → Parking → Pet → Smoking → Access → Price scope → Funds → Provider handoff → Photo. Admission sits with fit evidence, not at the bottom of a twelve-block stack.

### 6.3 Collapsed hotel card

Insert `<HotelAdmissionCardChip>` immediately after `<HotelCardEligibilityLine>` (line 906) and before `<ParkingSummary>`.

**In `not_provided` — the current 100% case — the chip renders `null` and the collapsed card is byte-identical to `main`.** That is the acceptance number: zero height delta, zero new element, for every offer shipping today. Placing the chip below the price/rate row also guarantees it cannot outrank price, Deal Score, or location.

The card's accessible name (`HotelCard.tsx:761`) is **not** modified by this ticket; `getRateRestrictionsAccessibleSummary` keeps its signature and its output. `getAdmissionAccessibleSummary` is exported for a future ticket to compose, and is used in this ticket only for the chip's `aria-label`.

### 6.4 Density budget at 375px

| Surface | Delta in `not_provided` | Delta when restricted (1 family, 1 statement) |
|---|---|---|
| Collapsed card | **0px** | one chip line, ≈28px |
| Expanded card | 4 text lines, ≈78px, inside an already-scrolling disclosure | ≈130px |
| Booking review section 3 | 4 text lines, ≈96px | ≈170px |

Sections 1–2 are unmoved on the review page in every state. The section-4 CTA moves down by less than one third of a 375px viewport in the worst designed case (four restricted families, three statements each), so it remains reachable within the same scroll gesture pattern travelers already use for sections 3→4.

### 6.5 1280px

Single column at both widths. The review panel inherits `sm:px-5 sm:py-4`; the card block keeps `px-3.5 py-3` matching its siblings. Statement prose is unconstrained in width and wraps naturally inside the existing panel column — no two-column split, because a verbatim legal sentence split across columns is harder to read, not easier.

---

## 7. Interaction rules

| Trigger | Behaviour |
|---|---|
| Panel renders (any state) on a surface | Fire `hotel_admission_policy_viewed` once per hotel per surface per mount. Never on re-render. |
| Card expanded via `Details` | Panel renders inside the disclosure; fires its `viewed` event on first expansion only. |
| Tap on panel | Nothing. The panel is not interactive in any state. |
| Keyboard Enter/Space inside panel region | Nothing. No focusable descendant exists. |
| `loadState` transitions `loading → ready`/`error` | `aria-live="polite"` announces the resolved body sentence; reserved height prevents CTA displacement. |
| Handoff CTA clicked while `hasRestriction` is true | Fire `hotel_handoff_with_admission_restriction` **before** navigation, inside the existing `emitAnalytics` try/catch (`BookingFlow.tsx:154`). Analytics never blocks or alters the handoff. |
| Provider name missing | All copy substitutes `The booking provider` / `the booking provider`. No other fallback. |
| Any error in derivation | The normalizer never throws; malformed evidence resolves to `not_provided` (gate 1/4). |

---

## 8. Analytics (Directive 5.5)

Both events must be added to `EVENT_PROPERTIES` (`app/api/analytics/route.ts:12`) **and** to `REQUIRED_PROPERTIES` (`line 56`), and their new keys need validators in `validPropertyValue` (`line 122`), or they are silently rejected.

```
hotel_admission_policy_viewed:            ['hotel_id', 'surface', 'source', 'evidence_state', 'families_reported', 'viewport_group']
hotel_handoff_with_admission_restriction: ['hotel_id', 'surface', 'source', 'restricted_families']
```

### 8.1 One resolved conflict: `provider` → `source`

Research Directive 5.5 named a `provider` key. The shipped validator for `provider` (`route.ts:140`) accepts only `['expedia','booking','kiwi','trip']` — it would reject `hotellook` and `bookingcomrapidapi`, which are the only two suppliers this feature can ever report. The `source` key (`route.ts:157`) already validates `['hotellook','duffel','amadeus','kiwi','travelpayouts','other']`, which is exactly the right domain.

**Decision: use `source`, not `provider`.** This satisfies the directive's actual requirement (attribute the supplier, pass the route's existing validators) without widening a validator that other events depend on. Unknown suppliers map to `'other'`.

### 8.2 New validators

```ts
if (key === 'evidence_state') return oneOf(value, ['loading', 'error', 'not_provided', 'reported'])
if (key === 'families_reported' || key === 'restricted_families') {
  // 'none' (families_reported only), or a comma-joined subset of ADMISSION_FAMILY_ORDER,
  // in that exact order, no duplicates, max 4 members.
}
```

`hotel_id`, `surface`, `source`, and `viewport_group` reuse their existing validators unchanged.

### 8.3 Value rules

| Key | Value |
|---|---|
| `hotel_id` | `HotelOffer.id`. If it fails `OPAQUE_VALUE`, **the event is not sent at all** rather than sent with a substitute — a fabricated id is worse than a missing row. |
| `surface` | `'results'` for the hotel card (collapsed or expanded); `'handoff'` for the booking review. `'detail'` is unused by this feature. |
| `source` | Normalized supplier, `'other'` when unrecognized. |
| `evidence_state` | Panel presentation state. |
| `families_reported` | Families that produced a row, in `ADMISSION_FAMILY_ORDER`; `'none'` when zero. |
| `restricted_families` | Families with `rowState: 'restricted'`, in `ADMISSION_FAMILY_ORDER`. The event does not fire when this would be empty, so `'none'` is never sent. |

**No free text ever leaves the client**: no `sourceText`, no `sourceLabel`, no property name, no address, no `minimumAge`. The age integer is deliberately excluded — it is a property fact that adds nothing to a disclosure-rate metric and widens the payload surface for no benefit.

---

## 9. Provider scope line (Directive 5.1–5.4)

**UI stage ships:** the types (§1), `lib/hotels/admissionPolicy.ts` (§2), `app/components/HotelAdmissionPolicy.tsx` with all seven states (§5), all copy (§3), all three placements (§6), the analytics wiring plus the server allowlist and validator additions (§8), and `HOTEL_ADMISSION_POLICY_UNSUPPORTED` declared by both adapters.

**Adapters.** `lib/providers/hotellook.ts` sets `admissionPolicyCapability: HOTEL_ADMISSION_POLICY_UNSUPPORTED` alongside `createNotReturnedHotelFundsPolicy` / `notProvidedHotelSmokingPolicy` (`~406–407`) and leaves `admissionPolicy` undefined. `lib/providers/bookingComRapidApi.ts` does the same. Both keep returning `Result<T>` and never throw.

**Booking-context plumbing — explicit scope note.** The review panel cannot render without the evidence reaching `BookingHotelContext`. UI therefore also adds `admissionPolicy?` and `admissionPolicyCapability?` to `BookingHotelContext` (`lib/booking/config.ts:52–77`), with validators modelled exactly on `validateHotelRateEligibilityEvidence` / `validateHotelRateEligibilityCapability` (`lib/booking/config.ts:640–681`), and passes them through `buildBookingHotelContext` (`line 945`) in the same conditional-spread style. This is plumbing for a designed surface, not value population.

**Out of scope for UI, requires a separate DEV/provider ticket:** populating any real value. No fixture-backed value may reach a production path; research fixtures stay under `app/components/research/`. No money, deposit, or fee string belongs in this panel — that is `HotelFundsPolicyEvidence`.

---

## 10. Acceptance checklist for TEST

1. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.
2. `git diff` shows `lib/hotels/rateEligibility.ts` and `app/components/HotelRateRestrictions.tsx` **unmodified**.
3. `grep -nE "Ages .*only|Rate restrictions|maxAge|adultsOnly|photoIdRequired|cardInGuestName|localResidentsBarred|maxOccupancy|sleeps"` over delivered files returns nothing.
4. `grep -rniE "no age restriction|no restrictions|all guests welcome|no id required|no minimum age|anyone can check in|open to all"` over `app/` and `lib/` returns nothing.
5. `ADMISSION_FAMILY_ORDER` has exactly four members in the order `checkin_age, checkin_identity, local_guest_restriction, occupancy_admission`.
6. An offer with no `admissionPolicy` renders: panel present, exactly one not-provided sentence pair, zero rows, zero success tokens, zero check-marks.
7. **Collapsed-card height for an all-`not_provided` offer at 375px is identical to `main`.**
8. Evidence with a mismatched `propertyId` or `supplier` renders `not_provided`, never a partial merge.
9. `minimumAge` of `-1`, `20.5`, `'21'`, or `0` renders `not_provided`, never a number.
10. A `confirmed` negative with `capability` absent or `false` renders `not_provided`, not a reassurance.
11. `conflicting` renders both statements attributed and produces no chip.
12. Expanded card DOM order: quality → location → **admission** → parking. Review DOM order: hotel-fit section contains the `h3` and precedes `hotel-provider`.
13. Heading outline on the review page is h1 → h2 → h3 → h4 with no skips; the expanded card gains no heading.
14. Tab order unchanged on both surfaces.
15. No horizontal overflow at 375px with a 300-character statement; no overlapping text at 375px or 1280px.
16. POSTing each event with the §8 key set returns success; removing any key from `EVENT_PROPERTIES` makes it fail (proving the allowlist is the gate).

---

## 11. Handoff

Next stage: **`UI-HOTEL-POLICY-EXCEPTIONS-01`** — implement §1–§9 exactly. Every state in §5, every string in §3, tokens from `app/globals.css` only, all existing exports and component contracts preserved, no value population.
