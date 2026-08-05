# UXDES-HOTEL-PAYMENT-METHOD-01 — Payment-Method Acceptance Confidence — Design Spec

**Stage:** UX Design · **Ticket:** UXDES-HOTEL-PAYMENT-METHOD-01 · **Priority:** P1
**Date:** 2026-08-05 · **Feature slug:** `hotel-payment-method`
**Upstream:** `docs/pipeline/hotel-payment-method/02-research.md`
**Downstream:** `UI-HOTEL-PAYMENT-METHOD-01`, then `DEV-HOTEL-PAYMENT-METHOD-01`

---

## 0. What is being built, in one paragraph

A single new disclosure panel, `HotelPaymentAcceptanceEvidence` (six fixed facts: whether a credit card
is required at the property, whether each of credit/debit/prepaid/cash is accepted at the property, and
whether the booking gate's accepted set differs from the property's), rendered exactly once per booking
review — immediately below the existing deposit/hold panel in `BookingFlow.tsx` — never per result card.
Every fact renders one of three values today, and under current supply (0% across all three reachable
providers) all six render `not_confirmed`. Alongside it: the existing `paymentMethodWording` fact inside
`HotelFundsPolicyPanel` is relabelled so it can no longer be misread as stay-price acceptance evidence, and
a tenth `HotelReturnReason` value is added so a check-in payment refusal becomes attributable in returns
data.

## 1. Decisions carried from research, not reopened

- Greenfield type, capability-gated, all three adapters wired to `false` (research §1.3, §5).
- One mount point (`BookingFlow.tsx`, after the funds-policy full panel), no `HotelCard.tsx` chip
  (research §5.2). This is a deliberate divergence from the admission-policy precedent, which does have a
  card chip — admission's chip only fires when `hasRestriction` is true, i.e. it never appears at 0%
  restriction rate; this feature's chip would have to appear on literally every card today (every fact is
  `not_confirmed`), which is exactly the per-result habituation failure discovery forbids.
- Reuse `HotelChargeCollector`, reuse `credit_card`/`debit_card`/`cash`, add `prepaid_card`, reuse
  `HotelFundsEvidenceScope` (research §3.3).
- `not_confirmed` always renders; it is never an omitted row (research §5, directive 1).

## 2. Information architecture

### 2.1 Fixed row order (never resorted, never filtered)

1. **Credit card required at the property** — the single highest-severity go/no-go (discovery §6.1 cue 1).
2. **Credit cards accepted at the property**
3. **Debit cards accepted at the property**
4. **Prepaid cards accepted at the property**
5. **Cash accepted at the property**
6. **Whether this differs from what you need to book** — the G1-vs-property seam (discovery §6.1 cue 3).

Rows 2–5 are visually grouped under one sub-heading ("Accepted at the property"); rows 1 and 6 stand alone
above and below that group respectively, because they are the two facts with direct decision
consequence on their own (row 1: "can I even complete check-in"; row 6: "does clearing booking mean
anything about clearing the property").

### 2.2 Hierarchy relative to the surrounding surface

On `BookingFlow.tsx`'s review page, in top-to-bottom decision-cost order: price and Deal Score (primary,
unchanged) → hotel fit / admission eligibility (unchanged) → special requests (unchanged) → **deposits and
holds** (existing `HotelFundsPolicyPanel`, full variant) → **this panel** (new) → offer details disclosure
(unchanged). This panel is placed directly after deposits/holds, not before, because it answers "will my
card even work" only after the traveler has already seen "what will be held" — reading order should follow
booking order (you learn what will be tested before you learn whether your instrument passes). It never
displaces price or Deal Score, and it never appears above the fold ahead of them, satisfying discovery §5
constraint 3.

### 2.3 Not a `HotelCard.tsx` addition, by directive (research §5.2, restated as a design decision)

No summary chip, no card-level row, no card-level badge. This is the one instance in the codebase's
established two-tier disclosure pattern where the second tier does not exist, and that asymmetry is
intentional, not an oversight — record it here so DEV does not "complete the pattern" by adding one later
without a supply change to justify it.

---

## 3. The lexicon module — `lib/hotels/paymentAcceptance.ts` (DEV implements)

### 3.1 Fixed headings and row labels

| Row id | Label |
|---|---|
| `card_required_at_property` | Credit card required at the property |
| `credit_card` | Credit cards |
| `debit_card` | Debit cards |
| `prepaid_card` | Prepaid cards |
| `cash` | Cash |
| `booking_gate_divergence` | Same as what you needed to book? |

Panel heading (both surfaces): **"Payment accepted at the property"**. Sub-heading above rows 2–5:
**"Accepted at the property"**.

### 3.2 Per-row sentence, every value, final copy

**Row 1 — `card_required_at_property`** (`HotelPropertyCardRequirement`: `required | not_required |
not_confirmed`):

| Value | Sentence |
|---|---|
| `required` | `{Provider} says this property requires a credit card at check-in.` |
| `not_required` | `{Provider} says this property does not require a credit card at check-in.` |
| `not_confirmed` | `{Provider} has not confirmed whether this property requires a credit card at check-in.` |

**Rows 2–5 — instrument classes** (`HotelPropertyPaymentInstrumentState`: `accepted | not_accepted |
not_confirmed`), templated per class label (`{class}` = "Credit cards" / "Debit cards" / "Prepaid cards" /
"Cash"):

| Value | Sentence |
|---|---|
| `accepted` | `{Provider} says {class_lower} are accepted at this property.` |
| `not_accepted` | `{Provider} says {class_lower} are not accepted at this property.` |
| `not_confirmed` | `{Provider} has not confirmed whether {class_lower} are accepted at this property.` |

`{class_lower}`: "credit cards" / "debit cards" / "prepaid cards" / "cash" (cash sentence reads "cash is
accepted" / "cash is not accepted" / "whether cash is accepted" — singular verb; DEV must special-case
agreement for `cash`, the other three are plural).

**Row 6 — `booking_gate_divergence`** (`HotelBookingGateDivergence`: `same | differs | not_confirmed`):

| Value | Sentence |
|---|---|
| `same` | `{Provider} says the property accepts the same payment methods you used to book.` |
| `differs` | `{Provider} says the property may require different payment methods than what you used to book. Review the rows above before you check in.` |
| `not_confirmed` | `{Provider} has not confirmed whether the property accepts the same payment methods you used to book.` |

### 3.3 Panel-level status line (rendered once, above the rows)

- All six `not_confirmed` (today's universal render): **"{Provider} has not confirmed payment acceptance
  at the property for this stay. None of the facts below come from a provider yet — confirm with the
  property before you travel."**
- At least one row confirmed (`required`, `not_required`, `accepted`, `not_accepted`, `same`, or
  `differs`), at least one row still `not_confirmed`: **"{Provider} confirmed some payment-acceptance facts
  for this property. Facts marked “not confirmed” below still need to be checked with the property."**
- All six confirmed: **"{Provider} confirmed payment acceptance at the property for this stay."**
- `card_required_at_property === 'required'` **always** additionally appends, regardless of which status
  line above fired: **"Bring a credit card. Properties that require one at check-in will refuse a debit or
  prepaid card for this purpose even if it paid for the stay."** — this is the single highest-severity
  sentence in the panel and must render directly under the status line, not buried in row 1, because a
  traveler scanning only the top of the panel must still see it.

### 3.4 Conflicting-fact copy (row-scoped, not panel-scoped)

A single row can independently be `conflicting` even while others are confirmed or not_confirmed — providers
disagree fact-by-fact, not panel-wide (mirrors funds-policy's per-record conflict, not admission's
whole-family conflict). Replace that row's sentence with:
**"Providers disagree on this. {Provider A} says {value A}; {Provider B} says {value B}. expaify cannot
determine which applies — confirm with the property before you travel."**
Row visually gets `--warning-soft` background + `--border-strong`, same tone family as
`HotelFundsPolicyPanel`'s conflicting state, scoped to the row not the whole panel (unlike admission, which
turns the row copy amber but not a background box — this feature's conflicting row needs the stronger
treatment because unlike admission "conflicting" here is the failure mode most likely to strand a traveler,
per discovery §1).

### 3.5 Missing-field phrases — not applicable

Unlike funds policy and payment timing, this feature has no `missingFields` list — every row always has a
value (`not_confirmed` fills the gap in place of an omission), so there is no separate "the provider didn't
return X" sentence to compose. This is a deliberate simplification versus the funds-policy/admission
precedent and should not be "fixed" by DEV into matching their shape.

### 3.6 Scope and provenance sentence — rendered in every state except `loading`

`"Source: {Provider} · {scope label} · Checked {date}"` when `fetchedAt` is present and scope is not
`not_returned`; `"Source: {Provider} · Scope not confirmed"` when scope is `not_returned`. Reuses
`scopeLabels` already defined in `HotelFundsPolicyPanel.tsx:47-53` — do not redefine a parallel copy of
that record; DEV should export and share it, or import it, rather than duplicate the four strings.

### 3.7 Cross-reference to the funds/deposit panel — one direction only

Directly under the provenance sentence, always rendered (all states): **"This does not cover the deposit or
incidental hold amount — see Deposits and card holds above."** One-way only: the funds-policy panel is not
edited to reference this panel (it already exists and ships regardless of whether this feature ships), and
this panel must always reference it, since it renders below.

### 3.8 Forbidden-word rules (assertable as unit tests)

1. No row sentence, in any state, may contain the word "guaranteed," "safe," "fine," or "should work" —
   the entire point of `not_confirmed` is to avoid false reassurance; softened language defeats it.
2. `paymentMethodWording`'s relabelled `Fact` (§6 below) must never contain the words "accepted" or
   "accepts" — it describes an obligation's applicable instrument, never acceptance for the stay.
3. The `not_confirmed` row sentence must always name the gate ("at the property," "you used to book") —
   never a bare "not confirmed" with no object, which is exactly the ambiguity discovery's constraint 2
   forbids.

### 3.9 Date formatting

Reuse `HotelFundsPolicyPanel.tsx`'s `sourceCopy` date formatting (`toLocaleDateString('en-US', { month:
'short', day: 'numeric', year: 'numeric' })`) verbatim — do not introduce a third date format into the
hotel review surface (admission uses `formatAbsoluteFreshness`, funds policy uses the inline formatter
above; this feature follows funds policy's, since it sits directly beside it and a visible format
mismatch between two adjacent panels reads as a bug).

---

## 4. Data contract, as designed

### 4.1 Types (DEV implements in `lib/types.ts`)

```ts
export type HotelPropertyCardRequirement = 'required' | 'not_required' | 'not_confirmed';

export type HotelPropertyPaymentInstrumentClass =
  | 'credit_card' | 'debit_card' | 'prepaid_card' | 'cash';

export type HotelPropertyPaymentInstrumentState = 'accepted' | 'not_accepted' | 'not_confirmed';

export type HotelBookingGateDivergence = 'same' | 'differs' | 'not_confirmed';

export type HotelPaymentAcceptanceFactState =
  | HotelPropertyCardRequirement
  | HotelPropertyPaymentInstrumentState
  | HotelBookingGateDivergence; // structurally a superset; each field is independently typed below, this alias exists only for shared conflict-record typing

export interface HotelPaymentAcceptanceConflict {
  sourceLabelA: string;
  valueA: string;      // one of the three value vocabularies above, as returned by that source
  sourceLabelB: string;
  valueB: string;
}

export interface HotelPaymentAcceptanceEvidence {
  /** Literal. There is no rate-scoped variant, matching admission policy's shape (research §3.3). */
  scope: HotelFundsEvidenceScope;
  /** Must match the rendered offer's id; mismatch degrades the whole record to all-not_confirmed. */
  propertyId: string;
  /** Must match HotelOffer.source; mismatch degrades the whole record to all-not_confirmed. */
  supplier: string;
  loadState: 'loading' | 'ready' | 'error';
  fetchedAt?: string;
  cardRequiredAtProperty: HotelPropertyCardRequirement;
  cardRequiredConflict?: HotelPaymentAcceptanceConflict;
  instruments: Record<HotelPropertyPaymentInstrumentClass, HotelPropertyPaymentInstrumentState>;
  instrumentConflicts?: Partial<Record<HotelPropertyPaymentInstrumentClass, HotelPaymentAcceptanceConflict>>;
  bookingGateDivergence: HotelBookingGateDivergence;
  bookingGateDivergenceConflict?: HotelPaymentAcceptanceConflict;
  sourceLabel: string;
}

/** Declares whether an adapter's contract can return an explicit answer for each fact. All-false today. */
export interface HotelPaymentAcceptanceCapability {
  cardRequiredAtProperty: boolean;
  instrumentClasses: boolean;
  bookingGateDivergence: boolean;
}
```

Both members optional on `HotelOffer`: `paymentAcceptance?`, `paymentAcceptanceCapability?`. Absent is
legal and renders identically to "capability false" (§4.4). `HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED` (all
three flags `false`) is exported from `lib/hotels/paymentAcceptance.ts` and wired on all three provider
adapters, exactly as `HOTEL_ADMISSION_POLICY_UNSUPPORTED` is (research §5, directive 5).

**Why `instruments` is a fixed `Record`, not an array (unlike `HotelStayPaymentMethod[]` in the sibling
spec):** all four classes must always be answerable (§2.1); an array could omit a class silently. A fixed
four-key record makes "no evidence for prepaid" and "prepaid confirmed not accepted" structurally distinct
at the type level, matching `HotelAdmissionPolicyEvidence.families`' fixed-key shape.

### 4.2 Presentation type (DEV implements, UI consumes)

```ts
// app/components/HotelPaymentAcceptance.tsx (UI stage defines this shape; DEV's normalizer targets it)
export type HotelPaymentAcceptanceRowId =
  | 'card_required_at_property' | 'credit_card' | 'debit_card' | 'prepaid_card' | 'cash'
  | 'booking_gate_divergence';

export type HotelPaymentAcceptanceRowTone = 'confirmed_positive' | 'confirmed_negative' | 'not_confirmed' | 'conflicting';

export interface HotelPaymentAcceptanceRow {
  id: HotelPaymentAcceptanceRowId;
  label: string;
  tone: HotelPaymentAcceptanceRowTone;
  sentence: string;
}

export type HotelPaymentAcceptancePresentation =
  | { state: 'loading' }
  | { state: 'error' }
  | {
      state: 'ready';
      statusLine: string;
      cardRequiredWarning: boolean;   // drives §3.3's always-appended bring-a-credit-card sentence
      rows: readonly HotelPaymentAcceptanceRow[]; // always exactly 6, fixed order per §2.1
      provenance: string;             // §3.6, pre-composed
    };
```

`confirmed_positive` = `required` / `accepted` / `same` (the reassuring half of each pair — still neutral
tone, never success-green, because "required" is not good news even though it is "confirmed"). `tone`
naming intentionally avoids "positive/negative" implying good/bad; it means "the confirmed value that
keeps the traveler's plan intact" vs. "the confirmed value that narrows their options." Rendering-wise
both confirmed tones share the same neutral style (§5); only `not_confirmed` and `conflicting` get warning
treatment. This spec deliberately does not give `required`/`not_accepted` a stronger visual warning than
other confirmed facts, even though they are worse news for some travelers — a debit-only traveler wants
`not_accepted` to be exactly as loud as `accepted` is for a credit-card traveler; making rejection visually
scarier than acceptance would itself be an editorial inference the evidence doesn't support.

### 4.3 Degradation rules (normalizer, `lib/hotels/paymentAcceptance.ts`)

Applied in order, always toward less certainty:

1. **Provenance mismatch** — `propertyId`/`supplier` don't match the displayed offer: whole record
   degrades, every row renders `not_confirmed` (precedent: `admissionPolicy.ts` propertyId/supplier check,
   `rateEligibility.ts:110-112`).
2. **Capability false for a fact family** — if `capability.cardRequiredAtProperty` is false, row 1 is
   always `not_confirmed` regardless of what `evidence.cardRequiredAtProperty` says (an adapter must not
   be able to assert a fact it declared it cannot answer). Same independently for `instrumentClasses`
   (gates all four instrument rows together — a provider either can or cannot speak to instrument
   acceptance, there is no partial-class capability) and `bookingGateDivergence`.
3. **Conflicting takes precedence over confirmed for that row only** — if a row has a populated `*Conflict`
   object, that row renders `conflicting` regardless of the row's own top-level value, and the top-level
   value for that row is ignored for display (still used for analytics dimensions).
4. **`Result<T>`, never throws** — a fetch failure is the component's `error` **load state**, distinct from
   any row's `not_confirmed` value; `not_confirmed` means "asked, no answer," `error` means "could not
   ask."
5. **Never inferred** — no row's value may be derived from `fundsPolicy`, `admissionPolicy`,
   `rateEligibility`, the partner domain, brand reputation, or another row in this same evidence record
   (e.g., `not_required` on row 1 must never imply `accepted` on rows 2–5; discovery §5 constraint 2
   applies fact-by-fact, not just panel-wide).

### 4.4 Absent evidence

`offer.paymentAcceptance === undefined` renders identically to "capability all false, evidence present but
empty": all six rows `not_confirmed`, panel status line is §3.3's first variant, `sourceLabel` falls back
to `providerDisplayName(offer.source)`, `scope` renders as "Scope not confirmed." There is no separate
"field not present" visual state — to the traveler it means exactly what a fully-not_confirmed record
means, matching `hotel-payment-timing/03-design.md §4.4`'s precedent for the same situation.

### 4.5 Serialization (DEV, `lib/booking/config.ts`)

Follow `admissionPolicy`'s pattern exactly, not funds-policy's: `BookingHotelContext` gains
`paymentAcceptance?: HotelPaymentAcceptanceEvidence` and `paymentAcceptanceCapability?:
HotelPaymentAcceptanceCapability`, both serialized as a single JSON-in-query-param blob each (matching
`admissionPolicy`/`admissionPolicyCapability` at `config.ts:1333-1334`), not flattened into scalar keys —
this record's six facts plus two conflict-bearing sub-objects do not compress cleanly into scalars the way
payment-timing's five did, and admission policy already established the "reconstruct as one JSON blob"
route in this exact file for a same-shaped fixed-family evidence record.

---

## 5. Component spec

### 5.1 Public surface (UI stage implements)

```tsx
// app/components/HotelPaymentAcceptance.tsx
export function HotelPaymentAcceptanceSection({
  presentation,
  providerName,
  rootRef,
}: {
  presentation: HotelPaymentAcceptancePresentation
  providerName: string
  rootRef?: Ref<HTMLElement>
}): JSX.Element
```

One export, one variant (`review`/handoff only — no `card` variant, per §2.3). No `confirmHref` /
"Confirm with partner" link in v1: research found no partner-deeplink target that specifically answers
property payment acceptance (unlike funds policy, which links out because the partner's own checkout may
disclose the deposit amount) — inventing a link target here would encourage a click that resolves nothing,
so this panel closes on the provenance/cross-reference sentences instead. Record this as a UI decision so a
future stage doesn't add a placeholder link.

### 5.2 Container and row classes

Container (mirrors `HotelAdmissionPolicySection`'s `<section>` shape, promoted to full-card weight to match
its neighbour `HotelFundsPolicyPanel` `variant="full"`, since both now sit at the same hierarchy level):

```
rounded-[var(--radius-card)] border p-3.5 sm:p-5
```
Border/background: `border-[color:var(--border)] bg-[color:var(--bg-surface)]` in the "all confirmed, no
warning" case; `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` whenever
`cardRequiredWarning` is true OR any row is `conflicting` (mirrors `HotelFundsPolicyPanel`'s `warningState`
composition, `HotelFundsPolicyPanel.tsx:276-280`); plain `border-[color:var(--border)]
bg-[color:var(--bg-raised)]` for the ordinary all-`not_confirmed` case (today's default — a **not** state,
distinguished from "confirmed and reassuring," matching `HotelFundsPolicyPanel`'s treatment of
`not_returned` as a *raised*, not warning, tone at summary level, but promoted to warning tone at full-panel
`showConfirmation`-style prominence... — resolved: use `bg-[color:var(--bg-raised)]` /
`border-[color:var(--border)]`, i.e. neutral, not amber, for pure `not_confirmed`, reserving amber strictly
for `cardRequiredWarning` and `conflicting`, so the panel is not permanently amber-toned at 0% supply,
which would itself become the habituated wallpaper discovery's constraint 3 warns against one layer up).

Heading: `text-base font-medium leading-6 text-[color:var(--text-1)] sm:text-lg` (matches
`HotelFundsPolicyPanel`'s `<h3>` at `:327`).

Row list: `<dl>`-free — use `<ul className="mt-4 space-y-3">`, each row an `<li>` with
`border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0` (matches
`HotelAdmissionPolicy.tsx`'s row pattern). Row label: `text-sm font-medium leading-5
text-[color:var(--text-1)]`. Row sentence: `mt-1 break-words text-sm leading-6
text-[color:var(--text-1)]` for `confirmed_positive`/`confirmed_negative`/`not_confirmed`; `mt-1
break-words text-sm font-medium leading-6 text-[color:var(--warning)]` for `conflicting`, with the row
itself additionally wrapped in a `rounded-[var(--radius-control)] border border-[color:var(--border-strong)]
bg-[color:var(--warning-soft)] p-2.5 -mx-2.5` box per §3.4.

Sub-heading above rows 2–5 (row `credit_card` through `cash`): `<p className="mt-4 text-xs font-medium
uppercase tracking-wide text-[color:var(--text-3)]">Accepted at the property</p>`, rendered once, before
row 2, not repeated.

`cardRequiredWarning` sentence (§3.3, when present): rendered directly under the status line, above the
row list, as `mt-2 text-sm font-medium leading-6 text-[color:var(--warning)]` — same tone as `--warning`
text used elsewhere for the one sentence in the panel most likely to change a traveler's decision.

Provenance + cross-reference (§3.6–3.7): `mt-3 break-words border-t border-[color:var(--border)] pt-3
text-xs font-medium leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]` — identical treatment to
`HotelFundsPolicyPanel.tsx:393-395` so the two adjacent panels' footers read as one visual family.

### 5.3 Loading and error states

`loading`: heading + `<p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Checking
payment acceptance…</p>` + three skeleton bars, identical structure to
`HotelFundsPolicyPanel.tsx:331-338`.

`error`: heading + `<p ...>Payment acceptance could not be checked.</p>` + `<p
...>Confirm accepted payment methods with the property or booking partner before you travel.</p>`,
identical structure to `HotelFundsPolicyPanel.tsx:340-345`. Both `loading` and `error` get
`role="status" aria-live="polite" aria-busy` on the loading branch only, matching
`HotelFundsPolicyPanel.tsx:322-324`.

---

## 6. Every state, rendered

### 6.1 `ready`, all six `not_confirmed` — today's universal state

```
Payment accepted at the property
{Provider} has not confirmed payment acceptance at the property for this stay. None of the facts below
come from a provider yet — confirm with the property before you travel.

{Provider} has not confirmed whether this property requires a credit card at check-in.

Accepted at the property
{Provider} has not confirmed whether credit cards are accepted at this property.
{Provider} has not confirmed whether debit cards are accepted at this property.
{Provider} has not confirmed whether prepaid cards are accepted at this property.
{Provider} has not confirmed whether cash is accepted at this property.

{Provider} has not confirmed whether the property accepts the same payment methods you used to book.

Source: {Provider} · Scope not confirmed
This does not cover the deposit or incidental hold amount — see Deposits and card holds above.
```

### 6.2 `ready`, card required + partial confirmation (illustrative — no current adapter reaches this)

Status line variant 2 fires. `cardRequiredWarning` sentence fires. Rows 1 (`required`), `credit_card`
(`accepted`) render confirmed copy in neutral tone; `debit_card`, `prepaid_card` remain `not_confirmed`;
`cash` confirmed `not_accepted`; row 6 `not_confirmed`.

### 6.3 `ready`, fully confirmed, no divergence (illustrative)

All six rows confirmed, status line variant 3, no `cardRequiredWarning` unless row 1 is `required` (it can
be fully confirmed and still `required` — the warning sentence is independent of "how much is confirmed").

### 6.4 `ready`, one row `conflicting`

E.g. row `debit_card`: two sources disagree. That row alone gets the amber box + §3.4 sentence naming both
sources and both values; the other five rows render normally at whatever state they hold independently.
Panel container takes warning tone (§5.2) because at least one row conflicts.

### 6.5 `loading`

Per §5.3.

### 6.6 `error`

Per §5.3.

### 6.7 Empty

Not applicable — this panel has no empty state distinct from all-`not_confirmed`; per §4.4 that state
always renders content, never a blank panel.

---

## 7. Responsive, keyboard, screen reader

### 7.1 Breakpoints

**375px:** panel padding `p-3.5`, row sentence `text-sm` wraps to 2–3 lines per row without truncation
(`break-words`), sub-heading and rows stack full width, no horizontal scroll. **1280px:** panel padding
`p-5`, sits at the same column width as the funds-policy panel above it (both full-bleed within the review
column, no new grid introduced).

### 7.2 Live regions

`loading`/`error` only: `role="status" aria-live="polite" aria-busy` (loading only) on the section root,
identical contract to `HotelFundsPolicyPanel` and `HotelAdmissionPolicySection`. `ready` state is static
content, no live region (matches both precedents — a fully-rendered panel does not need to interrupt
screen-reader flow).

### 7.3 Tab order

No interactive elements in v1 (§5.1 — no confirm link). The panel is a static, `aria-labelledby` landmark
between the funds-policy panel and the "Show offer details" `<details>`; tab order is unaffected — a
screen-reader user reaches it via heading/landmark navigation exactly as they reach the funds-policy panel
today.

### 7.4 Accessibility of the six-row structure

Rows render as a `<ul>`/`<li>` list (not a `<dl>`), each row's label as a `<p className="font-medium">`
(not a heading element — six new `<h4>`s per booking review would over-populate the page's heading outline
for a set of facts that are peers, not sub-sections; this diverges from `HotelAdmissionPolicy.tsx`'s
`HeadingTag` choice deliberately, because admission's rows are conditionally present with independent
statement lists, while this panel's six rows are always all present as one flat fact table). Panel section
itself: `aria-labelledby` pointing at the one `<h3>` heading, matching every existing hotel evidence panel
in this codebase.

---

## 8. Instrumentation — `app/components/hotelPaymentAcceptanceAnalytics.ts` (DEV implements)

Mirrors `hotelAdmissionPolicyAnalytics.ts`'s shape:
- `useHotelPaymentAcceptanceViewed({ presentation, hotelId, source })` — fires once per hotel per mount on
  `BookingFlow`, event `hotel_payment_acceptance_viewed`, dimensions: `evidence_state` (derived: `'all_not_confirmed'
  | 'partial' | 'complete' | 'conflicting'` — computed from the six row tones, not stored on the type),
  `card_required` (`required | not_required | not_confirmed`), `source`, `viewport_group`. This directly
  instruments discovery §4's "Per-gate evidence completeness" and "Instrument-fit comprehension" baselines.
- `trackHotelHandoffWithPaymentUnconfirmed({ presentation, hotelId, source })` — fires on the outbound
  booking-partner click (existing handoff CTA elsewhere in `BookingFlow.tsx`, not owned by this panel) when
  `evidence_state !== 'complete'`, instrumenting discovery §4's "Payment-stage failure rate" precursor: how
  often a traveler leaves for the partner site without full confirmation.
- Both wrapped in try/catch, analytics never throws or blocks render/handoff, matching
  `hotelAdmissionPolicyAnalytics.ts:33-39`'s `emit()` pattern exactly.

---

## 9. `HOTEL_RETURN_REASONS` amendment (DEV implements, `BookingFlow.tsx`)

Insert immediately after `pay_at_property_amount_unexpected`:

```ts
{ value: 'pay_at_property_method_not_accepted', label: 'My card or payment method was not accepted at the property' }
```

`HotelReturnReason` union gains `'pay_at_property_method_not_accepted'` in the same position. No other
change to the returns UI — it renders via the existing `HOTEL_RETURN_REASONS.map(...)` loop
(`BookingFlow.tsx:1135-1146`) with no special-casing needed.

---

## 10. `paymentMethodWording` relabel (UI stage implements, `HotelFundsPolicyPanel.tsx`)

Replace the static label at `HotelFundsPolicyPanel.tsx:232`:

```tsx
{record.paymentMethodWording ? <Fact label="Payment method" value={record.paymentMethodWording} /> : null}
```

with a label resolved per obligation type, reusing the existing lowercase forms already available at that
call site via `mechanismLabels`:

```tsx
{record.paymentMethodWording ? (
  <Fact
    label={`Applies to this ${record.type ? mechanismLabels[record.type].toLowerCase() : 'obligation'}`}
    value={record.paymentMethodWording}
  />
) : null}
```

Resolved labels: "Applies to this temporary card hold" / "Applies to this refundable deposit" / "Applies
to this other refundable amount" / "Applies to this obligation" (no `type`). None contains "accepted" or
"payment method" as a bare noun phrase, satisfying §3.8 rule 2. No change to `HotelFundsEvidenceRecord`,
`normalizeHotelFundsPolicyEvidence`, or `missingFieldPhrases.payment_method` (research §5, directive 3) —
this is the entire diff for this sub-feature.

---

## 11. Acceptance criteria

### 11.1 Copy and lexicon
- Every row sentence in §3.2 implemented verbatim, correct singular/plural agreement for `cash`.
- `cardRequiredWarning` sentence renders whenever, and only whenever, `cardRequiredAtProperty === 'required'`
  after conflict resolution.
- No row sentence contains "guaranteed," "safe," "fine," or "should work" (§3.8 rule 1) — unit-testable via
  string scan over all row-sentence builder outputs across all value combinations.
- Relabelled `Fact` never renders the words "accepted" or "accepts" (§3.8 rule 2).

### 11.2 Normalizer
- Provenance mismatch degrades all six rows to `not_confirmed`.
- Capability-false gates each fact family independently; instrument capability is all-four-or-none.
- A populated conflict object on any row forces that row's tone to `conflicting` regardless of its
  top-level value.
- Absent `offer.paymentAcceptance` renders identically to present-but-empty-capability (§4.4).
- Returns `Result<T>`, never throws, for malformed adapter input (extra keys, wrong-typed values, out-of-
  vocabulary strings).

### 11.3 Rendering
- Panel mounts exactly once, in `BookingFlow.tsx`, directly after the funds-policy full panel. No mount in
  `HotelCard.tsx`.
- All six rows render in fixed order in every state; none are conditionally omitted.
- Container tone: neutral for pure `not_confirmed`, warning for `cardRequiredWarning` or any `conflicting`
  row.

### 11.4 Accessibility and responsive
- `loading`/`error` carry `role="status"`/`aria-live="polite"`/`aria-busy` per §5.3; `ready` does not.
- 375px: no horizontal scroll, all six rows legible, no truncation.
- 1280px: panel width matches its neighbouring funds-policy panel.
- Panel `<h3>` uniquely `aria-labelledby`-referenced; no duplicate landmark id with the funds-policy panel.

### 11.5 Non-regression
- `HotelFundsPolicyPanel` obligations render identically except for the one relabelled `Fact`.
- `HotelCard.tsx` unaffected (no import of the new component).
- `HOTEL_RETURN_REASONS` existing nine values unchanged in order and value except for the one insertion.
