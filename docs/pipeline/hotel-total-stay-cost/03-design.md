# UXDES-HOTEL-TOTAL-STAY-COST-01: Total Stay Cost Confidence — Design Spec

Date: 2026-07-29
Stage: UX Design
Persona: Senior UX Designer / Interaction Designer
Ticket: UXDES-HOTEL-TOTAL-STAY-COST-01 (P0)

Input: `docs/pipeline/hotel-total-stay-cost/02-research.md`
Upstream: `docs/pipeline/hotel-total-stay-cost/01-discovery.md`
Inherited as settled: `docs/pipeline/total-stay-cost/02-research.md`, `docs/pipeline/hotel-price-visibility/02-research.md`
Output of this stage: this document. Handoff: `UI-HOTEL-TOTAL-STAY-COST-01`.

---

## 0. What This Spec Delivers

One **cost-knowledge classification** with four members, one **copy source** consumed identically by four surfaces, one **attribution rule**, and one **occupancy sentence**. It replaces four independently-maintained `per night before taxes and fees` literals (`HotelCard.tsx:359`, `HotelCard.tsx:1047`, `app/deals/[dealId]/page.tsx:379`, `BookingFlow.tsx:239`) with a single named source.

**Reachability, stated up front so TEST scores the right thing:**

| Class | Reachable in this ticket | TEST expectation |
|---|---|---|
| `provider_total` | **No — DEV-gated** | Fully specified here. Not implemented. **Must not be failed.** |
| `partial_total` | **No — DEV-gated** | Fully specified here. Not implemented. **Must not be failed.** |
| `expaify_estimate` | **Yes** | Must be implemented on all four surfaces. |
| `nightly_only` | **Yes** | Must be implemented on all four surfaces. |

The two DEV-gated classes are specified in full — strings, tokens, placement, screen-reader text — because the model is only correct as a four-member set. They become reachable when a DEV provider-adapter ticket lands. Nothing in this spec asks UI to build a code path that no data can enter; §9 states exactly which branches UI writes and which it does not.

---

## 1. The Classification

### 1.1 Four classes, no more

```
HotelStayCostState =
  | 'provider_total'    // provider returned a stay total covering the selected stay
  | 'partial_total'     // provider returned a stay total AND named charges it excludes
  | 'expaify_estimate'  // pricePerNight × nights, computed by expaify, nothing confirmed
  | 'nightly_only'      // no total derivable — nights missing/invalid, or price invalid
```

**`partial_total` is adopted**, per research Directive 1. The Google rate contract itemizes `Baserate` / `Tax` / `OtherFees` separately, so a provider returning a total that excludes a charge it names is a *normal* response shape, not an edge case. Folding it into `provider_total` would present a number that will change as a number that will not — the exact harm this ticket exists to remove.

**`conflicting` is rejected, and here is the sentence a future implementer needs to read before re-proposing it:** stay cost has exactly one price source per offer (`priceFrom`, normalized to `pricePerNight` at `lib/providers/hotellook.ts:395`, `:412-419`). There is no second source to disagree with, so the state is not merely unreachable — it is unconstructible. The deposit model needs `conflicting` because obligation records from different scopes can genuinely disagree and only the property can resolve it; "these two numbers disagree" is not an action a shopper can take about a room rate.

**The scenario that resembles `conflicting` is a DEV reconciliation rule, not a user-facing state.** Spec'd here so DEV does not invent a fifth class:

> **Adapter reconciliation rule (DEV).** If a provider returns both a stay total and a nightly rate that do not reconcile (`total ≠ nightly × nights`, beyond a ±1-cent rounding tolerance per night), the **provider total is authoritative**. The nightly rate is then displayed as *derived from the total* — Google's own direction of derivation — and the discrepancy is **logged, never surfaced**. The offer is classed `provider_total` or `partial_total` as normal. No user-facing copy exists for this condition and none may be written.

**`price_unavailable` is not a class.** `HotelCard`'s existing `PriceUnavailable` (`:367-384`) is untouched, per inherited directive 4. See §3.5 for how an invalid price interacts with `nightly_only`.

### 1.2 The presentation model

UI-stage builds a **pure presentation module**, `lib/hotels/stayCostDisclosure.ts`. It changes no provider contract, no API route, no shared type in `lib/types.ts`, and no `HotelOffer` field. It reads what each surface already has and returns a disclosure value. DEV later replaces its *inputs* (§9) without changing its outputs.

The model is a **discriminated union**, and the discrimination is the enforcement mechanism for the hard constraint that computed and provider-returned figures are never interchangeable:

```ts
import type { Money } from '@/lib/types'
import type { HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

type Occupancy = HotelSearchCriteriaV1['occupancy']   // reuse; do NOT mint a new token
type StayCostScope = 'stay' | 'rate' | 'room' | 'property' | 'not_returned'

export type HotelStayCostDisclosure =
  | {
      state: 'provider_total'
      nightly: Money
      nights: number
      stayTotal: Money
      includesTaxesAndFees: boolean      // true ONLY when the provider states inclusion
      sourceLabel: string                // provider name — required
      scope: StayCostScope
      fetchedAt: string | null
      occupancy: Occupancy
    }
  | {
      state: 'partial_total'
      nightly: Money
      nights: number
      stayTotal: Money
      excludedCharges: string[]          // provider-NAMED charges only; never invented
      sourceLabel: string                // provider name — required
      scope: StayCostScope
      fetchedAt: string | null
      occupancy: Occupancy
    }
  | {
      state: 'expaify_estimate'
      nightly: Money
      nights: number
      subtotal: Money                    // nightly.priceCents × nights, integer cents
      occupancy: Occupancy
      // NO sourceLabel. NO scope. NO fetchedAt. NO provider field of any kind.
    }
  | {
      state: 'nightly_only'
      nightly: Money | null              // null when the price itself is invalid
      reason: 'nights_unavailable' | 'price_unavailable'
      sourceLabel: string                // provider name — this IS a source-attributed record
      scope: 'not_returned'
      fetchedAt: string | null
      occupancy: Occupancy
    }
```

Three properties of this shape are load-bearing:

1. **`expaify_estimate` has no field that can hold a provider name.** A UI implementer cannot accidentally render `Source: Hotellook` under an estimate, because there is nothing to render. This satisfies the constraint that the rule "cannot be satisfied by styling alone."
2. **`nightly_only` is a constructed, source-attributed value, not an absent optional** — mirroring `createNotReturnedHotelFundsPolicy` (`lib/hotels/fundsPolicy.ts:181-188`). It says *"we asked {Provider} and got no total"*, not silence. UI constructs it via a named factory:
   ```ts
   createNightlyOnlyStayCost(sourceLabel: string, reason, nightly, occupancy)
   ```
3. **No `kind: 'exact' | 'range' | …` union.** `HotelFundsAmount`'s `range` member is deliberately not reused — importing it would reopen the settled no-fee-range decision (inherited directive 5). **No range of any kind, for any charge, on any surface.**

### 1.3 Derivation — exact precedence

`deriveHotelStayCost(input): HotelStayCostDisclosure`, evaluated top-down, first match wins:

| # | Condition | Result |
|---|---|---|
| 1 | `!isValidMoney(nightly)` | `nightly_only`, `reason: 'price_unavailable'`, `nightly: null` |
| 2 | Provider stay total present **and** provider names excluded charges | `partial_total` *(DEV-gated — no input can satisfy this today)* |
| 3 | Provider stay total present | `provider_total` *(DEV-gated)* |
| 4 | `nights` fails the validity test below | `nightly_only`, `reason: 'nights_unavailable'` |
| 5 | `nightly.priceCents × nights` is not a safe integer | `nightly_only`, `reason: 'nights_unavailable'` |
| 6 | otherwise | `expaify_estimate` |

**`nights` validity test:** `Number.isInteger(nights) && nights >= 1 && nights <= 365`. `null`, `undefined`, `0`, negatives, non-integers, `NaN`, and values above 365 all fail. 365 is a guard against a corrupt date range producing a five-figure "estimate", not a product rule.

**Currency:** the subtotal inherits `nightly.currency` verbatim. No conversion, no mixing. Money stays `{ priceCents, currency }` end to end; the subtotal is `nightly.priceCents * nights` in integer cents. `formatMoney` is the only thing that produces a display string. **Raw cents are never interpolated into copy.**

**`nights === 1`:** renders `expaify_estimate` with singular copy. It is **not** suppressed even though the subtotal equals the nightly rate. Suppressing it would make the one-night stay the only case with no cost-status line, and on a surface where every other card carries one, absence reads as confidence.

---

## 2. Copy — Written Once, Referenced By Name

All strings live in `lib/hotels/stayCostDisclosure.ts` and are produced by two functions. **No surface may inline a cost string.** These two functions are the sole replacement for `HotelCard.tsx:359`, `HotelCard.tsx:1047`, `page.tsx:379`, and `BookingFlow.tsx:239` (`getHotelPriceBasisLabel`, which is deleted).

```ts
getStayCostScanCopy(d: HotelStayCostDisclosure): string | null
getStayCostDetailCopy(d: HotelStayCostDisclosure): { claim: string; provenance: string }
getStayCostOccupancyCopy(d: HotelStayCostDisclosure): string | null
getStayCostHandoffBoundaryCopy(providerLabel: string | null): string
```

`{n} nights` uses `nightsLabel(n) = n === 1 ? '1 night' : \`${n} nights\`` everywhere. Money always via `formatMoney`.

### 2.1 Scan strings — one line, no wrapping-dependent meaning

| Class | String |
|---|---|
| `provider_total` | `{total} total for {n} nights · from {Provider}` |
| `partial_total` | `{total} total for {n} nights · excludes {named charges} · from {Provider}` |
| `expaify_estimate` | `Est. {subtotal} for {n} nights · before taxes and fees` |
| `nightly_only` · `nights_unavailable` | `{nightly} per night · stay length unavailable` |
| `nightly_only` · `price_unavailable` | **`null` — renders nothing.** See §3.5. |

`{named charges}` is a comma-joined list of provider-supplied strings, verbatim, lowercased only at the first character if the provider capitalised it mid-sentence. **No charge name expaify invents may appear.** If the provider returns a total but names nothing it excludes, the class is `provider_total`, not `partial_total` — there is no "excludes some charges" copy and none may be written.

### 2.2 Detail strings — claim + provenance, two units

Rendered as two elements: a **claim** line (the cost statement) and a **provenance** line (who produced the figure). They are always adjacent and always in this order.

**`provider_total`**
- claim: `Stay total {total} for {n} nights, from {Provider}.` — append ` Includes taxes and fees.` **only** when `includesTaxesAndFees === true`. When `false`, append nothing. There is no "excludes taxes and fees" sentence for this class; that is what `partial_total` is for.
- provenance: `Source: {Provider} · {scope label} · Checked {date}` — produced by the existing `sourceCopy` shape (`HotelFundsPolicyPanel.tsx:165-173`). The `· Checked {date}` segment is omitted when `fetchedAt` is null or unparseable, exactly as `sourceCopy` already does.

**`partial_total`**
- claim: `Stay total {total} for {n} nights, from {Provider}. This total excludes {named charges}, which {Provider} lists as payable separately.`
- provenance: same `Source:` line as above.

**`expaify_estimate`**
- claim: `Estimated {subtotal} for {n} nights. expaify calculated this from the nightly rate; it is not a quote. Taxes and fees are not included, and no provider has confirmed a total for this stay.`
- provenance: `Calculated by expaify from the nightly rate · not provider-confirmed`
- **No `Source:` prefix. No provider name. No provider logo. Anywhere inside this unit.**

**`nightly_only` · `nights_unavailable`**
- claim: `{nightly} per night, before taxes and fees. Stay length is unavailable, so no stay cost is shown.`
- provenance: `Source checked: {Provider} · Scope not provided` — the `noEvidence` branch of `sourceCopy`, matching how `not_returned` funds policy already reads.

**`nightly_only` · `price_unavailable`** — renders nothing on every surface. The surface's existing price-unavailable treatment is authoritative and is not modified by this ticket.

### 2.3 The handoff boundary sentence

`{Provider} confirms the final total before you pay.` — inherited directive 6, verbatim. When the partner is unnamed: `The booking partner confirms the final total before you pay.`

This sentence is **not** part of any class string and **not** part of any provenance line. It lives only in the `BookingFlow` CTA/handoff zone (§5.5), where it describes what happens next rather than labelling a number.

**This resolves the tension with inherited directive 4** — whose fallback string was `"Est. {subtotal} for {n} nights, before taxes & fees. {Provider} confirms the final total."`, a single sentence carrying both an expaify figure and a provider name. That is a **refinement, not a reopening**: both claims survive, split into two units in two zones. Only the adjacency changes.

### 2.4 The attribution rule — one rule, four applications

1. **A figure a provider returned** carries that provider's name in the same visual unit, plus a `Source: …` provenance line.
2. **A figure expaify computed** carries no provider name, no provider logo, and no `Source:` line **anywhere inside its visual unit**. Its provenance line names expaify as the origin.
3. **The nightly rate keeps `Rate from {Provider}`** (`HotelCard.tsx:360`) — it genuinely is theirs. Unchanged.
4. **`per night before taxes and fees` may no longer be rendered inside a provider-attributed unit.** No adapter sets `priceBasis`; every producer is `lib/booking/config.ts:956`'s `?? 'per_night_before_taxes_fees'` fallback, which fabricates it. The phrase survives only inside the expaify-voiced class copy above.

**Cross-cutting copy prohibitions.** No string in this spec, and no string added downstream, may:
- imply a party size — no *"your total"*, no *"for your stay"*, no *"per guest"*, no pluralised guest language, in any class string, aria label, or tooltip;
- name a tax, fee, or charge the provider did not name;
- state a range for any charge;
- describe an estimate with a verb that implies confirmation (*confirmed*, *guaranteed*, *final*, *locked*).

---

## 3. Occupancy

### 3.1 Vocabulary — reuse, do not mint

Reuse `HotelSearchCriteriaV1['occupancy']` (`lib/hotels/searchCriteria.ts:11-13`): `{ state: 'not_captured' } | { state: 'applied'; adults; children; childAges; rooms }`.

**Do not create an `occupancy_unverified` token.** A second name for the same concept would fragment the shipped analytics enum `'applied' | 'not_captured'` (`app/api/analytics/route.ts:133`), which every call site already populates honestly.

### 3.2 The sentence

> `expaify does not know how many guests this rate covers. Confirm it applies to your party on the provider's site.`

Rendered when `occupancy.state === 'not_captured'`, which is universally true today. Rendered **never** when `occupancy.state === 'applied'` — the sentence is simply dropped, with no replacement string. That branch is unreachable today (`'applied'` is declared but never constructed) and must still be written, because it is one `if`.

This is the **only** place occupancy is discussed anywhere in the product's cost surfaces.

### 3.3 Sentence, not chip — and where it renders

| Surface | Occupancy sentence |
|---|---|
| `DealCard` scan | **Never** |
| `HotelCard` collapsed (summary strip) | **Never** |
| Deal detail price block | Yes |
| `HotelCard` expanded (Price scope panel) | Yes |
| `BookingFlow` pre-CTA | Yes |

`not_captured` is universally true, so a per-card occupancy chip would place an identical badge on every card in the feed — pure noise at 375px and exactly the decorative clutter the briefing forbids. It attaches structurally to every class; it renders only where the user is reading rather than scanning.

### 3.4 Guest input is neither a prerequisite nor sufficient

Capturing a guest count would not make any class more accurate: the value cannot reach `HotelProvider.searchHotels(area, range, context?)` (`lib/types.ts:533-537`, no occupancy parameter) and cannot return on `HotelOffer` (`lib/types.ts:474-494`, no occupancy field). Three contract changes are required. **Separate DEV ticket. Explicitly out of scope here.** This spec is correct without it and degrades cleanly with it — the `applied` branch drops one sentence and changes nothing else.

### 3.5 Interaction with an invalid price

When `nightly` is invalid, the disclosure is `nightly_only` / `price_unavailable` and **renders nothing at all** — no claim, no provenance, no occupancy sentence. `HotelCard`'s `PriceUnavailable` (`:367-384`), the deal detail page, and `BookingFlow` already own that condition with their own copy. Adding a cost-status line beside "Price unavailable" would be a statement about a number that isn't there.

---

## 4. Structural Grammar — Mirror The Funds Policy, Diverge Once

A traveler reading a deposit disclosure and a cost disclosure on the same card must not learn two grammars.

**Mirrored from `HotelFundsPolicyEvidence` / `HotelFundsPolicyPanel`:**

| Element | Funds precedent | Applied here |
|---|---|---|
| Constructed "not returned" value | `createNotReturnedHotelFundsPolicy` (`fundsPolicy.ts:181-188`) | `createNightlyOnlyStayCost(sourceLabel, …)` |
| `sourceLabel` + `scope` + `fetchedAt` | `lib/types.ts:314-323` | On all three provider-sourced classes |
| Provenance rendering | `sourceCopy` (`Panel.tsx:165-173`) | Same shape, same `Source: … · scope · Checked {date}` |
| `variant: 'summary' \| 'full'` | `Panel.tsx:35`, `:282-294` | Same prop name, same values |
| `surface: 'hotel_detail' \| 'book_handoff'` | `Panel.tsx:30` | Same prop name, same values |
| Summary = one bordered strip, one sentence | `Panel.tsx:283-293` | Identical container classes |
| Warning tone reserved for degraded states | `Panel.tsx:276` | `partial_total` and `nightly_only` only |
| `missingFields` names what is absent | `lib/types.ts:322` | `excludedCharges` names what `partial_total` excludes |

**The one deliberate divergence.** `expaify_estimate` has no analogue in the funds model — expaify never computes a deposit; every funds value is provider-sourced or explicitly absent. This is the only class whose provenance names *expaify* as the origin, and it must be **visually distinct from all three provider-sourced classes** (§6.3), so an implementer cannot render one in the other's treatment.

**Do not import `HotelFundsAmount`.** Its `kind: 'range'` member would reopen the settled no-fee-range decision.

---

## 5. Placement Per Surface

### 5.1 `DealCard` — `app/components/ui/DealCard.tsx`

**Data wiring (UI-stage, reachable now).** Add `nights?: number` to `DealCardDeal` (`:18-34`) and populate it at both call sites — the `DealFeed.tsx` prop object (`ApiDeal.nights` already exists at `app/api/deals/route.ts:24`, `:48`, `:70`, `:94`, declared client-side at `DealFeed.tsx:133`) and `app/page.tsx:37` `rowToCard`. This is inherited directive 1, still unimplemented.

**Placement.** One line, directly under the price row (`:85-98`), **above** `deal.headline` (`:100-102`). It is a sibling `<p>` inside the existing `space-y-2` stack — **not** inside the `flex flex-wrap items-baseline` price row, so it cannot compete with the discount chip or the strikethrough comparison for horizontal space.

```tsx
{scanCopy ? (
  <p className="text-caption font-medium leading-snug text-[color:var(--ink-faint)]">
    {scanCopy}
  </p>
) : null}
```

- Estimate and `nightly_only` share `--ink-faint` (AA 4.5:1 at caption size on `--surface`, per `globals.css:38`). Subordinate to the `text-h2 var(--primary)` nightly headline — the nightly rate remains the primary figure on this surface, per inherited directive 2.
- `provider_total` / `partial_total` (DEV-gated) use `text-[color:var(--ink-soft)]` — one step more prominent, because a provider-backed total is a stronger fact than an estimate. Never `--primary`; never larger than `text-caption`.
- **No `whitespace-nowrap`, no `truncate`.** The line wraps to two lines at 375px and that is correct; truncating a cost disclosure mid-clause is worse than wrapping.
- No occupancy sentence. No provenance line. Scan surfaces carry the class line only.

**Expired deals.** `deal.expired` already swaps the discount chip for an `Expired` pill (`:94-99`). The class line renders normally — the epistemic status of the price is unchanged by expiry, and the expiry treatment is adjacent and unambiguous.

### 5.2 Deal detail — `app/deals/[dealId]/page.tsx`

**Placement.** Inside the price block (`:376-380`), replacing the literal at `:379`, and positioned **before** the freshness copy at `:381-391`.

Order inside the block, top to bottom:
1. `Observed nightly rate` label (`:377`) — unchanged
2. `{formatMoney(...)}` figure (`:378`) — unchanged
3. **claim line** — replaces `per night before taxes and fees` at `:379`
4. **provenance line** — new
5. **occupancy sentence** — new
6. `Rate observed from a booking partner.` (`:380`) — unchanged
7. freshness / expiry copy (`:381-391`) — unchanged

```tsx
<p className="mt-1 text-sm text-[color:var(--text-2)]">{claim}</p>
<p className="mt-1 text-xs text-[color:var(--text-3)]">{provenance}</p>
{occupancyCopy ? (
  <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">{occupancyCopy}</p>
) : null}
```

`deal.nights` is already in server scope and already renders as an isolated `Nights` fact at `:362-363`, seventeen lines above the price it never touches. This closes that gap. The stay-context sentence at `:365-368` stays as-is — it describes the stay, not the cost.

**Deal Score guard.** Nothing from this spec enters the `DealScorePanel` at `:392-395`. `priceNoun="nightly rate"` and `unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."` are preserved **verbatim**. No stay total, computed or provider-returned, reaches `lib/scoring/scoreDeal.ts`.

### 5.3 `HotelCard` collapsed — `app/components/HotelCard.tsx`

**Placement: outside the `Price` block.** A sibling summary strip in the collapsed body stack, immediately **before** the funds-policy summary panel (`:916-926`).

Reasoning that must survive into implementation: the `Price` block (`:349-365`) ends with an unconditional `Last-checked time unavailable` in `var(--warning)` (`:361`), rendered for every offer regardless of actual freshness. Any cost statement placed inside that block inherits a permanent warning neighbour and reads as self-contradicting — a confident total sitting directly above a staleness warning. Placing the strip beside the funds summary also puts both money disclosures in one region, which is what makes the shared grammar of §4 legible.

```tsx
{scanCopy ? (
  <div className="mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-2)] {toneClasses}">
    <p>{scanCopy}</p>
  </div>
) : null}
```

Container classes are copied from `HotelFundsPolicyPanel`'s summary variant (`:283-293`) so the two strips are visually identical containers. Tone per §6.3. No occupancy sentence at this level. `Price` (`:349-365`) loses its line at `:359` and keeps `Rate from {providerName}` and the freshness line untouched.

### 5.4 `HotelCard` expanded — the "Price scope" panel

**Placement.** `:1045-1051`. The literal `per night before taxes and fees` at `:1047` is replaced by the claim line; provenance and occupancy sentence follow. `Rate check` (`:1048-1049`) and the unavailable-reason line (`:1050`) are unchanged.

```tsx
<p className="font-medium text-[color:var(--text-1)]">Price scope</p>
<p>{claim}</p>
<p className="mt-1 text-[color:var(--text-3)]">{provenance}</p>
{occupancyCopy ? <p className="mt-1 text-[color:var(--text-3)]">{occupancyCopy}</p> : null}
<p className="mt-2 font-medium text-[color:var(--text-1)]">Rate check</p>
```

This panel is inside the existing Details disclosure (`:971-979`), which already has its toggle, its `aria-expanded`, and its analytics. **No new toggle, no new focusable element.**

### 5.5 `BookingFlow` — `app/book/BookingFlow.tsx`

`getHotelPriceBasisLabel` (`:239-242`) is **deleted**. Both its call sites (`:351` visual, `:1014` accessible name) consume the shared copy source instead.

`BookingHotelContext` already carries `checkIn`, `checkOut`, and `nightCount` (`lib/booking/config.ts:66-68`). No contract change is needed. The prior brief's claim that this type structurally cannot show stay length is **obsolete**.

**Hotel summary panel (`:348-360`).** Replace `:355` (`getHotelPriceBasisLabel(...)`) with the claim line; add provenance beneath it; leave `Rate observed from {rateSource}.` (`:356`) and the freshness warning (`:357`) untouched.

**Pre-CTA zone — NON-COLLAPSIBLE.** Immediately above the continue CTA, always visible, never behind a disclosure:

1. claim line
2. provenance line
3. occupancy sentence (when `not_captured`)
4. handoff boundary sentence: `{Provider} confirms the final total before you pay.`

This is the last expaify-controlled screen. Nothing here may be placed inside a `<details>`, an accordion, a tab, or a "show more" affordance. It is the one surface where non-collapsibility is a hard requirement rather than a preference.

---

## 6. Visual Specification

### 6.1 Hierarchy — unchanged on every surface

Primary remains the **nightly rate figure**. The class line is secondary. Provenance and occupancy are tertiary. The class line is never larger, never bolder, and never more saturated than the nightly figure it sits under — including for `provider_total`. A provider-backed stay total is a stronger *fact*, not a promotion to headline.

| Rank | Element | Treatment |
|---|---|---|
| Primary | Nightly rate figure | unchanged (`text-h2` / `text-3xl` / `text-4xl`) |
| Secondary | Class claim line | `text-caption` (DealCard) / `text-sm` (detail, BookingFlow) / `text-xs` (HotelCard strip + panel) |
| Tertiary | Provenance line | one step down from the claim, `--text-3` / `--ink-faint` |
| Tertiary | Occupancy sentence | same as provenance |

### 6.2 Token usage

Only tokens already defined in `app/globals.css`. No new colours, no new font sizes.

- `DealCard` uses the local `--ink-*` / `--primary` family and the `.text-caption` / `.text-small` utilities, matching its file's convention.
- `HotelCard`, deal detail, and `BookingFlow` use the `--text-1/2/3`, `--bg-raised`, `--border`, `--border-strong`, `--warning`, `--warning-soft` family, matching theirs.
- These are aliases of one system (`globals.css:58-84`); matching the local convention per file is deliberate, not inconsistency.

### 6.3 Tone per class

| Class | Strip background | Strip border | Text | Rationale |
|---|---|---|---|---|
| `provider_total` | `--bg-raised` | `--border` | `--text-2` | Neutral. A documented fact needs no alarm. |
| `partial_total` | `--warning-soft` | `--border-strong` | `--text-2` | Warning tone — a named charge is still to come. Matches `Panel.tsx:276`. |
| `expaify_estimate` | `--bg-raised` | **`--border-strong` + `border-dashed`** | `--text-2`, provenance `--text-3` | **The single divergence.** See below. |
| `nightly_only` | `--warning-soft` | `--border-strong` | `--text-2` | Warning tone — we asked and got nothing. Matches the funds `not_returned` treatment. |

**`expaify_estimate`'s dashed border is the deliberate divergence from the funds grammar (§4).** It is the only dashed container in either disclosure family. It reads as *provisional* rather than *alarming* — an estimate is not a warning, it is an unconfirmed figure — and it is the visual signal an implementer cannot reproduce by accident on a provider-sourced class. Combined with the absence of a `Source:` line and the absence of any provider-name field on the type (§1.2), the estimate is distinguishable by border, by copy, and by structure. Three independent signals, because one is a styling decision and styling decisions get changed.

The dashed border is not used on `DealCard`, where the class line is a bare `<p>` with no container. There, the distinction rests on the `Est.` prefix and the absence of `· from {Provider}` — the two scan strings are unambiguous without a container.

### 6.4 Responsive — 375px and 1280px

**375px:**
- `DealCard`: class line is a full-width block below the price row. Wraps to at most two lines for the longest reachable string (`nightly_only`, ~44 chars). It cannot collide with the hotel name (`:74-79`), the stars/city/window line (`:80-82`), the discount chip (`:94-99` — inside the price row above), or `CompareRow` (rendered below the stack). Line height `leading-snug`, no truncation, no `nowrap`.
- `HotelCard`: the summary strip and the funds-policy summary are consecutive blocks in a vertical stack, each `mt-3`. They are stacked, never side-by-side at any width, so collision is structurally impossible.
- Deal detail and `BookingFlow`: single-column at 375px (`lg:grid-cols-*` collapses); the claim/provenance/occupancy lines stack inside the price card with `mt-1` spacing.
- `partial_total` with several named charges is the longest string in the model. At 375px it may reach three lines in the detail claim. That is acceptable and must not be truncated or clamped.

**1280px:**
- Deal detail and `BookingFlow` price cards sit in the `minmax(0,0.8fr)` column beside the Deal Score panel. The claim line wraps within that column; `break-words` is already present on the figure and the column has `min-w-0` in `BookingFlow` (`:351`). Add `min-w-0` to the deal-detail price card if the claim line forces overflow.
- `DealCard` class line renders on one line at all desktop widths for every string except a multi-charge `partial_total`.

### 6.5 Focus, keyboard, and tab order

**The disclosure adds zero focusable elements on every surface.** No toggle, no tooltip trigger, no "why?" link, no popover. Every line is static text.

Consequences, stated so TEST can verify them directly:
- Tab order is **byte-for-byte unchanged** on all four surfaces.
- No new focus ring is introduced; no existing focus ring moves.
- `HotelCard`'s Details toggle (`:971-979`) keeps its existing `aria-expanded` behaviour and its existing analytics. The expanded content grows; the control does not change.
- `BookingFlow`'s pre-CTA block sits between the last interactive element above it and the CTA. Because it is static, a keyboard user tabs from that element straight to the CTA — the disclosure is read by screen readers in document order without adding a stop.
- No `tabindex` is added anywhere.

### 6.6 Loading and error states

**There is no loading state, and this is deliberate.** The disclosure is derived synchronously from props that are present at first paint on every surface:
- `DealCard` — `nights` arrives in the same payload as `dealPrice`.
- Deal detail — server-rendered; `deal.nights` is in server scope.
- `BookingFlow` — `hotelContext` is fully resolved before render.
- `HotelCard` — derived from `hotel` props.

Therefore: **no skeleton, no spinner, no `aria-busy`, no `aria-live` region** for the cost disclosure. Adding a live region for text that never changes after mount would announce noise. This is the one place the spec deliberately does *not* mirror `HotelFundsPolicyPanel`, whose `loadState` exists because funds policy genuinely arrives asynchronously.

**There is no error state either.** Every failure mode of the derivation resolves to a class: bad price → `nightly_only` / `price_unavailable` (renders nothing); bad nights → `nightly_only` / `nights_unavailable`. `deriveHotelStayCost` never throws and has no failure return. If a surface passes garbage, it gets `nightly_only`, which is the honest answer.

---

## 7. Screen Reader Copy

The visual claim and provenance lines are plain text and are read in document order — no `aria-hidden`, no `sr-only` duplicate. Two composed accessible names must be updated because they currently assert the deleted literal.

### 7.1 `HotelCard.tsx:763` — `reviewAriaLabel`

Currently: `Review {name}. Nightly rate {price} before taxes and fees. Rate from {provider}. Last-checked time unavailable. …`

The segment `Nightly rate {price} before taxes and fees.` asserts the basis with no occupancy caveat and under provider attribution. Replace with the **detail claim + provenance + occupancy sentence**:

| Class | Segment |
|---|---|
| `provider_total` | `Nightly rate {price}. Stay total {total} for {n} nights, from {Provider}.[ Includes taxes and fees.] Source: {Provider}, {scope}[, checked {date}]. expaify does not know how many guests this rate covers.` |
| `partial_total` | `Nightly rate {price}. Stay total {total} for {n} nights, from {Provider}. This total excludes {charges}, which {Provider} lists as payable separately. Source: {Provider}, {scope}[, checked {date}]. expaify does not know how many guests this rate covers.` |
| `expaify_estimate` | `Nightly rate {price}. Estimated {subtotal} for {n} nights. expaify calculated this from the nightly rate; it is not a quote. Taxes and fees are not included, and no provider has confirmed a total for this stay. expaify does not know how many guests this rate covers.` |
| `nightly_only` · `nights_unavailable` | `Nightly rate {price} per night, before taxes and fees. Stay length is unavailable, so no stay cost is shown. expaify does not know how many guests this rate covers.` |
| `nightly_only` · `price_unavailable` | Unreachable here — `PriceUnavailable` and `unavailableAriaLabel` (`:764-766`) own it, unchanged. |

The remaining segments of `reviewAriaLabel` — `Rate from {provider}.`, `Last-checked time unavailable.`, `Opens expaify review before provider handoff.`, `{eligibilityAriaSummary}`, `{providerConfirmationCopy}`, `{policyAriaSuffix}` — are **unchanged and keep their order**. In the `expaify_estimate` case the following `Rate from {provider}` refers to the nightly rate, which is genuinely the provider's; the estimate sentence has already closed with "no provider has confirmed a total for this stay", so the boundary is stated before the attribution is heard.

### 7.2 `BookingFlow.tsx:1014` — `accessibleName`

Currently ends: `The selected nightly rate is {price}, {getHotelPriceBasisLabel(...)}. The final total may differ. …`

`The final total may differ.` states a risk with no basis and must be replaced by the class statement. New composition:

`{continueLabel} for {name}. Opens {partner} in a new tab. The selected nightly rate is {price}. {detail claim} {occupancy sentence, when not_captured} {Provider} confirms the final total before you pay. Confirm the room's smoking status and the property's current smoking rules on the booking partner.`

For `expaify_estimate` the claim explicitly says *expaify calculated this from the nightly rate; it is not a quote* — satisfying the research requirement that the handoff aria name state, when the class is an estimate, that the figure is expaify's arithmetic. The trailing smoking sentence is unchanged.

### 7.3 Occupancy in accessible names

The occupancy sentence appears in composed accessible names **only at detail and handoff** — the same rule as the visual sentence (§3.3). It does not enter `DealCard`'s markup or any scan-level accessible name.

---

## 8. Every State — Enumerated For TEST

| # | State | Expected result |
|---|---|---|
| 1 | `expaify_estimate`, nights = 5 | `Est. $1,250 USD for 5 nights · before taxes and fees` at scan; detail claim + expaify provenance + occupancy sentence |
| 2 | `expaify_estimate`, nights = 1 | Singular `1 night`. Rendered, not suppressed (§1.3) |
| 3 | `nights = 0` | `nightly_only` / `nights_unavailable` |
| 4 | `nights = null` / `undefined` | `nightly_only` / `nights_unavailable` |
| 5 | `nights` negative, fractional, `NaN`, or > 365 | `nightly_only` / `nights_unavailable` |
| 6 | `nightly` fails `isValidMoney` | `nightly_only` / `price_unavailable` → **renders nothing**; existing unavailable treatment intact |
| 7 | `nightly.priceCents × nights` exceeds safe-integer range | `nightly_only` / `nights_unavailable` |
| 8 | `occupancy.state === 'not_captured'` (universal today) | Occupancy sentence at detail + handoff; **absent** at scan |
| 9 | `occupancy.state === 'applied'` | Occupancy sentence absent everywhere; no replacement string |
| 10 | `provider_total` | **DEV-gated.** Spec'd, unreachable, not failed by TEST |
| 11 | `partial_total` | **DEV-gated.** Spec'd, unreachable, not failed by TEST |
| 12 | Loading | No loading state exists; no skeleton, no `aria-live` (§6.6) |
| 13 | Derivation error | Unreachable; every failure resolves to `nightly_only` (§6.6) |
| 14 | 375px, all reachable classes | Wraps, no truncation, no overlap with hotel name / stars / `CompareRow` / discount chip; `HotelCard` strip does not collide with funds summary |
| 15 | 1280px, all reachable classes | Single line at scan except multi-charge `partial_total`; no overflow in the `0.8fr` column |
| 16 | Keyboard | Tab order unchanged on all four surfaces; zero new focusable elements |
| 17 | Screen reader | §7.1 and §7.2 composed names correct per class |
| 18 | Expired deal (`deal.expired`) | Class line renders normally alongside the `Expired` pill |
| 19 | Deal Score panel | Contains no class string; `priceNoun="nightly rate"` preserved verbatim on both surfaces |
| 20 | Four legacy literals | `HotelCard.tsx:359`, `:1047`, `page.tsx:379`, `BookingFlow.tsx:239` all gone; `getHotelPriceBasisLabel` deleted |
| 21 | Regression: search, results, booking | Unchanged. No API route, provider, or scoring file touched |

---

## 9. UI vs DEV Split

### 9.1 UI-stage — `UI-HOTEL-TOTAL-STAY-COST-01`

1. Create `lib/hotels/stayCostDisclosure.ts`: the union (§1.2), `deriveHotelStayCost` (§1.3), `createNightlyOnlyStayCost`, and the four copy functions (§2). Pure module — no provider call, no API route, no `lib/types.ts` change, no business logic.
2. `DealCard` — add `nights?: number` to `DealCardDeal`; populate at `DealFeed.tsx` and `app/page.tsx:37` `rowToCard`; render the scan line (§5.1).
3. Deal detail — render claim + provenance + occupancy in the price block; delete the literal at `:379` (§5.2).
4. `BookingFlow` — delete `getHotelPriceBasisLabel`; render in the summary panel and the non-collapsible pre-CTA zone; update the accessible name at `:1014` (§5.5, §7.2).
5. `HotelCard` — summary strip outside `Price`; replace the `Price scope` literal; delete `:359`; update `reviewAriaLabel` (§5.3, §5.4, §7.1).
6. Run `npx tsc --noEmit --incremental false`. Must exit 0.

**Sequence:** `DealCard` → deal detail → `BookingFlow` → `HotelCard`. The first three are live routes. `HotelCard` remains unreachable from any route (a pre-existing navigation gap, unchanged since 2026-07-21), so its changes are correctness-for-when-reconnected — they are still required, not optional.

**UI writes the `provider_total` / `partial_total` copy functions and tone classes** (they are pure string and class-name code, trivially testable) **but wires no input that can produce them.** Branches 2 and 3 of the derivation table are unreachable by construction until DEV lands. That is the intended end state of this ticket.

### 9.2 DEV-stage — do not attempt in UI

- Replace `priceBasis?: 'per_night_before_taxes_fees'` on `HotelOffer` with a constructed cost-evidence value carrying `state`, `sourceLabel`, `scope`, `fetchedAt`, `excludedCharges`. Migrate `lib/booking/config.ts:956`'s `?? 'per_night_before_taxes_fees'` fallback and `app/api/analytics/route.ts:176`'s literal validator **together** — they are one change.
- Provider total / tax / fee fields in the adapters, plus the reconciliation rule (§1.1). **This is the gate on `provider_total` and `partial_total`.**
- Occupancy capture — three contract changes (`HotelSearchCriteriaV1` producer, `searchHotels` signature, `HotelOffer` field). **Separate ticket. Not a prerequisite.**
- Registering `hotel_handoff_return_reason_selected` in `EVENT_PROPERTIES`. **Separate ticket.**

---

## 10. Measurement

**No instrumentation is scoped into this feature, and no acceptance criterion in §11 depends on any dashboard.**

Correcting a stale premise carried in the ticket and the discovery: `lib/analytics.ts` is **not** a `console.debug` stub — it is a production Postgres sink writing via `/api/analytics`. A user-facing mismatch-report surface **does** ship at `BookingFlow.tsx:1029-1069`, including a `price_or_fees_mismatch` reason. The real constraint is narrower: its event `hotel_handoff_return_reason_selected` is not registered in `EVENT_PROPERTIES` (`app/api/analytics/route.ts:12-48`), so `:232`'s `if (!allowedProperties) return null` rejects it with a 400 and it never persists. The signal is emitted by shipped UI and discarded at the API boundary.

**Stated price confidence — moderated task only.** Protocol: show a participant a card for a 5-night stay for 4 guests. Before any click, ask them to state (a) what their card will be charged, (b) who set that number, (c) how sure they are, 1–5. Baseline today: (a) is unanswerable from the screen at any level of effort; (b) is wrong — users attribute the basis line to the provider, though no provider supplies it; (c) is uncalibrated. **Target: (b) is correct without opening details.**

**Surprise-cost report rate** is blocked on the one-line allowlist registration above, not absent. Until it lands, use the same moderated sessions.

---

## 11. Acceptance Criteria

1. Exactly four classes exist; `conflicting` is absent and the adapter-reconciliation rule (§1.1) is documented in the implementation.
2. `provider_total` and `partial_total` are unreachable and **not failed by TEST**. `expaify_estimate` and `nightly_only` are implemented on all four surfaces.
3. All cost copy comes from `lib/hotels/stayCostDisclosure.ts`. Zero inline cost strings. `getHotelPriceBasisLabel` is deleted; all four `per night before taxes and fees` literals are gone.
4. The `expaify_estimate` visual unit contains no provider name, no logo, and no `Source:` line — enforced by the type having no field for one, not by styling.
5. The occupancy sentence renders at detail and handoff only, never at scan, and no string anywhere implies a party size.
6. Every state in §8 behaves as tabulated.
7. At 375px: no overlap with hotel name, stars, `CompareRow`, or the discount chip on `DealCard`; no collision between the `HotelCard` cost strip and the funds-policy summary.
8. Tab order is unchanged on all four surfaces; zero focusable elements added.
9. No stay total reaches `lib/scoring/scoreDeal.ts`; `priceNoun="nightly rate"` is preserved verbatim on both Deal Score surfaces; no class string renders inside a Deal Score panel.
10. No fee range appears anywhere; `HotelFundsAmount` is not imported.
11. Money is `{ priceCents, currency }` throughout; every display string comes from `formatMoney`; no raw cents are interpolated into copy.
12. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.

---

## 12. Handoff

Next ticket: `UI-HOTEL-TOTAL-STAY-COST-01` — UI: total hotel stay cost disclosure.
Input: this spec. Scope: §9.1 only. `provider_total` / `partial_total` remain DEV-gated.
