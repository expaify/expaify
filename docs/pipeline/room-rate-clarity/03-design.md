# UX Design: Room And Rate Clarity — Disclosure-State Layer

Ticket: `UXDES-ROOM-RATE-CLARITY-01`
Stage: UX Design
Priority: P0
Date: 2026-07-21
Persona: Senior UX / Interaction Designer

## Source Inputs

- Discovery: `docs/pipeline/room-rate-clarity/01-discovery.md`
- Research: `docs/pipeline/room-rate-clarity/02-research.md`
- Code audited for this spec (line references are exact as of this worktree):
  - `app/components/HotelCard.tsx` (expanded panel `523-582`; `providerConfirmationCopy` `417`; rendered handoff line `576-577`; unavailable fallback `577-578`)
  - `app/book/BookingFlow.tsx` (`hotelTermsCopy` `18`; used at `493`, `504`, `510`)
  - `app/deals/[dealId]/page.tsx` (`332` — variant that drops "room availability")
  - `lib/types.ts` (`HotelOffer` `137-151`; `HotelRatingEvidence` / `HotelQualityConfidence` `103-117` — the confidence pattern this spec mirrors)
  - `app/globals.css` (token map `29-55`)

## What This Spec Delivers (and what it deliberately does not)

Per research Task 1, room type, bed configuration, meal plan, refundable flag, and cancellation deadline are **not obtainable from the only live hotel provider** (Hotellook `cache.json` is a price-aggregator with no rate-level fields). This is a **DEV/provider-integration blocker, not a mapping gap**.

Therefore the deliverable is the **disclosure-state layer**, not populated data:

- For each of four attributes — **refundable flag**, **cancellation deadline**, **room & bed**, **meal plan** — this spec defines all five disclosure states (provider-backed, provider-returned-unavailable, not-returned, loading, error) with **final copy, no placeholders**.
- **Only the `not-returned` state is reachable today.** The provider-backed and provider-returned-unavailable states are fully specified so they are ready the moment a rate-shopping provider lands, but they are **not implementable against Hotellook `cache.json`** (see Acceptance Criteria / DEV Blocker).
- It replaces the single deferred sentence in the `HotelCard` expanded panel with four explicit per-attribute lines.
- It consolidates the three duplicated handoff sentences into one shared constant and fixes the `deals/[dealId]` variant.

**Explicitly out of scope** (do not design or build):
- Any cross-card comparison UI — no results-list refundable filter, badge, sort, or comparison table (research Task 5: infeasible under single-provider data).
- Any room inventory browser, multi-rate table, or room-selection flow (discovery constraint #3).
- Full cancellation-policy education / comprehension UX — that belongs to `UXD-CANCELLATION-POLICY-01`. This spec's cancellation-deadline copy is scoped to **disclosure-of-absence only**.
- Any inferred or defaulted value. If the provider did not return it, it renders as "not provided" — never a soft assumption, never a generic placeholder like "Standard Room."

---

## 1 — Hierarchy And Placement In The Expanded Panel

The four disclosures live in **one new bordered section, "Room & rate details,"** styled identically to the existing `QualityEvidencePanel` (`HotelCard.tsx:322-360`): `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3`.

**Insertion point:** immediately **after** `QualityEvidencePanel` and the low-confidence warning, and **before** the Location block (`HotelCard.tsx:557`). This groups the two "what do we actually know about this offer" evidence panels together and keeps the existing Location and Price-scope blocks in place.

**Nothing existing is displaced.** Order inside the expanded panel becomes:

1. Photo (unchanged)
2. `DealScorePanel` (unchanged) — **primary**
3. `QualityEvidencePanel` (unchanged)
4. Low-confidence warning (unchanged)
5. **NEW: Room & rate details** — this spec
6. Location (unchanged)
7. Price scope (modified — see §4)

**Priority ranking within the new section** (research Task 3, by CTA-decision / regret impact):

| Rank | Attribute | Row treatment |
|---|---|---|
| 1 | **Refundable** | Full-width, top of section, emphasized `dt`. Highest regret risk. |
| 2 | **Cancellation deadline** | Directly beneath refundable, visually subordinate (indented / smaller, muted). **Never standalone** — always reads as a qualifier of the refundable row. |
| 3 | **Room & bed** | Standard row. |
| 4 | **Meal plan (this rate)** | Standard row. Rate-scoped label. |

Refundable + cancellation deadline occupy one grouped block at the top; room & bed and meal plan sit below as a two-up `dl` grid on desktop, single column on mobile — matching the `QualityEvidencePanel` `dl` pattern (`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6`).

---

## 2 — Disclosure States And Final Copy

Every attribute has five states. **Reachable today** = the state the UI actually renders against Hotellook `cache.json` now. All copy below is final (no placeholders, no TODO). Provider vocabulary in provider-backed states is shown **verbatim** from the provider — never paraphrased into a category expaify invents.

### 2.1 Refundable flag — `dt`: "Refundable"

| State | Reachable today | `dd` copy |
|---|---|---|
| provider-backed (refundable) | No | `Refundable` |
| provider-backed (non-refundable) | No | `Non-refundable` |
| provider-returned-unavailable | No | `Refundability not specified for this rate` |
| **not-returned** | **Yes** | `Refundability not provided by this provider — confirm before payment` |
| loading | No | `Checking refundability…` |
| error | No | `Refundability could not be loaded` |

Rules: never infer refundability from price tier or hotel class. Never default to implying refundable. "not-returned" is the only state Hotellook can produce today, and it is decision-relevant on its own (it tells the user to verify before paying).

### 2.2 Cancellation deadline — `dt`: "Cancellation deadline" *(subordinate to Refundable)*

| State | Reachable today | `dd` copy |
|---|---|---|
| provider-backed (deadline known) | No | `Free cancellation until {deadline}` — where `{deadline}` is the provider-returned date/time in the user's terms. Shown **only** when refundable = true; never standalone. |
| provider-returned-unavailable | No | `Cancellation deadline not specified for this rate` |
| **not-returned** | **Yes** | `Cancellation deadline not provided by this provider` |
| loading | No | `Checking cancellation deadline…` |
| error | No | `Cancellation deadline could not be loaded` |

Rules: **disclosure-of-absence only in this ticket.** Do not build a populated cancellation-policy education panel, comprehension aids, or refundable-first sorting — that is `UXD-CANCELLATION-POLICY-01`'s scope. Never invent a placeholder deadline or a generic "usually 24–48 hours" default. When refundable is not-returned/unavailable, the deadline row still renders its own not-returned line but reads as subordinate to the refundable row above it (the deadline is meaningless without a refundable flag).

### 2.3 Room & bed — `dt`: "Room & bed"

| State | Reachable today | `dd` copy |
|---|---|---|
| provider-backed | No | `{room name}, {bed config}` verbatim — e.g. `Standard Room, 1 King Bed` |
| provider-returned-unavailable | No | `Room type not specified for this rate` |
| **not-returned** | **Yes** | `Room type not provided by this provider` |
| loading | No | `Checking room details…` |
| error | No | `Room details could not be loaded` |

Rules: never render a generic "Standard Room" placeholder that could read as provider-sourced. Room/bed strings are shown verbatim from provider vocabulary, not paraphrased.

### 2.4 Meal plan — `dt`: "Meal plan (this rate)"

| State | Reachable today | `dd` copy |
|---|---|---|
| provider-backed (included) | No | `This rate includes breakfast` (or the provider's own rate-plan meal label, verbatim) |
| provider-backed (room only) | No | `Room only — no meals included in this rate` |
| provider-returned-unavailable | No | `This rate does not specify a meal plan` |
| **not-returned** | **Yes** | `Meal plan not provided by this provider for this rate` |
| loading | No | `Checking meal plan…` |
| error | No | `Meal plan could not be loaded` |

**Rate-vs-property vocabulary contract** (research Task 2 item 2 + Directive 4): this attribute is **always rate-scoped**. The `dt` label carries the qualifier "(this rate)" and every `dd` string names "this rate." This ticket **must never** render a bare "Breakfast" chip. The adjacent, stalled `hotel-amenity-provenance` work owns **property-level** breakfast as a facility ("Breakfast service" at the property, provider-confirmed / not returned). The two must never appear on the same card as two unqualified "Breakfast" labels. Shared vocabulary going forward:
- This ticket: **"Meal plan" / "this rate includes breakfast"** (rate inclusion)
- Amenity-provenance: **"Breakfast service"** (property facility)

If amenity-provenance resumes, its chip and this line must be reviewed together against this vocabulary before merge.

---

## 3 — State Derivation (UI ← data)

The three data-truth states map to the existing `HotelRatingEvidence` confidence idiom (`lib/types.ts:103-117`). Loading and error are **UI** states, not data states.

| UI state | Trigger |
|---|---|
| provider-backed | attribute present with a `provider_backed` confidence value |
| provider-returned-unavailable | attribute present with an explicit `provider_unavailable` / none value |
| not-returned | attribute field absent from the offer (**always true under Hotellook today**) |
| loading | the offer/rate request is still resolving (independent of Deal Score loading — do not couple to the `loading` prop that drives `ScoreChip`) |
| error | the rate-attribute fetch failed (`Result.ok === false`) |

Because Hotellook returns none of these fields, **every row renders its `not-returned` copy today**. The section is not empty and not hidden — the honest "not provided" disclosure *is* the shipped content.

---

## 4 — Change To The Existing Deferred Sentence (`HotelCard.tsx`)

Today the expanded panel's "Price scope" box (`HotelCard.tsx:571-579`) ends with:

```
Provider handoff
{canBook ? reviewDisclosure : unavailableReason}   // reviewDisclosure = providerConfirmationCopy (line 417/418)
```

That single deferred sentence is the only place room/rate/cancellation is mentioned in the expanded view — the exact pattern research flagged for replacement.

**Change:**
- **Remove** the visible "Provider handoff" sub-block (the `reviewDisclosure` paragraph, `HotelCard.tsx:576-577`) from the expanded panel. Its room/rate/cancellation content is now carried, far more specifically, by the new "Room & rate details" section (§1–§2).
- **Preserve** the unavailable-state behavior: when `!hasValidPrice || !hasBookingUrl`, the Price-scope box still surfaces `unavailableReason` (`HotelCard.tsx:578`). Keep that line; it is about booking-link/price availability, not rate attributes.
- **Keep** "Price scope" (`per night before taxes and fees`) and "Rate check" (`rateCheckCopy`) unchanged — taxes/fees basis stays disclosed in the expanded view.
- The generic handoff sentence is **not lost from the product**: it remains on the "Review hotel" CTA `aria-label` (`reviewAriaLabel`, `HotelCard.tsx:419`) and on the BookingFlow / deals surfaces, now via the shared constant (§5). `reviewDisclosure` (the local alias at line 418) is removed once its only consumer is gone.

Net effect in the expanded panel: the user who opens Details now sees four specific, individually-labeled rate facts (or their honest absence) instead of one vague "provider will confirm later" sentence.

---

## 5 — Shared Copy Constant (fixes the three-way duplication)

The near-identical handoff sentence is hardcoded three times, one variant dropping "room availability":

- `app/components/HotelCard.tsx:417` — `providerConfirmationCopy`
- `app/book/BookingFlow.tsx:18` — `hotelTermsCopy`
- `app/deals/[dealId]/page.tsx:332` — variant: `"…cancellation policy, and final total are confirmed by the provider."` (**drops "room availability"**)

**Spec (flag to DEV as a shared-constant extraction, not a redesign):**

1. Add one exported constant — canonical wording, includes "room availability":
   ```
   // lib/booking/handoffCopy.ts
   export const HOTEL_PROVIDER_HANDOFF_COPY =
     'Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.'
   ```
2. `HotelCard.tsx`: import it; `providerConfirmationCopy` becomes this constant (still used by `reviewAriaLabel`). Remove the local literal.
3. `BookingFlow.tsx`: replace the `hotelTermsCopy` literal with the import (used at `493`, `504`, `510`).
4. `deals/[dealId]/page.tsx:331-332`: keep the "Nightly rate before taxes and fees." lead sentence, then use the shared constant as the second sentence so the deals surface regains "room availability":
   ```
   Nightly rate before taxes and fees. {HOTEL_PROVIDER_HANDOFF_COPY}
   ```

One wording, one source of truth, "room availability" restored everywhere.

---

## 6 — Visual / Token Spec

Reuse existing tokens only (no new colors, no new font sizes). Mirror `QualityEvidencePanel`.

**Section container:**
`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]`, `aria-label="Room and rate details"`.

**Section title:** `p` — `font-bold text-[color:var(--text-1)]`, text "Room & rate details".

**Refundable row (rank 1, emphasized):** full width, directly under title.
- `dt`: `font-bold text-[color:var(--text-1)]`
- `dd`: `mt-0.5 font-medium`. Tone by state:
  - provider-backed refundable → `text-[color:var(--success)]`
  - provider-backed non-refundable → `text-[color:var(--text-2)]`
  - **not-returned (today)** → `text-[color:var(--warning)]` (this is the "confirm before payment" advisory; warning tone matches the existing `--warning`/`--warning-soft` disclosure idiom used for freshness/low-confidence in this card)
  - loading → `text-[color:var(--text-3)]`
  - error → `text-[color:var(--error)]`

**Cancellation deadline row (rank 2, subordinate):** directly beneath refundable, indented `pl-3` with a `border-l border-[color:var(--border)]`, `text-[color:var(--text-3)]` for the `dd` when not provider-backed, so it reads as a qualifier of the refundable row rather than a peer fact.

**Room & bed + Meal plan (ranks 3–4):** a `dl` — `mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6`.
- `dt`: `font-bold text-[color:var(--text-1)]`
- `dd`: `mt-0.5 font-medium text-[color:var(--text-2)]`; error state `text-[color:var(--error)]`.

**Loading rows:** may pair with `aria-live="polite"` (they are transient async states); use `text-[color:var(--text-3)]`. No spinner needed — text state is sufficient and matches `ScoreChip`'s "Score pending" idiom.

---

## 7 — Responsive: 375px And 1280px

- **375px (mobile):** `dl` collapses to `grid-cols-1`; all four rows stack. Refundable full-width; cancellation deadline indented beneath it; room & bed and meal plan single-column. Copy strings wrap (`break-words` as in Location block) — the longest today, "Refundability not provided by this provider — confirm before payment," wraps to ≤3 lines at 375px inside `px-3.5`. No horizontal scroll, no truncation of disclosure copy (unlike the collapsed-card chips, these must stay fully readable).
- **1280px (desktop):** section spans the card content column; room & bed / meal plan render two-up (`sm:grid-cols-2`); refundable + cancellation stay stacked at top for emphasis. Section height adds one panel between Quality evidence and Location — Deal Score, quality evidence, location, and price-scope keep their positions and sizes.

Verified against the existing expanded-panel width constraints (`px-3 sm:px-5`, `HotelCard.tsx:524`); the new section uses the same insets as its sibling panels, so it inherits their proven 375px/1280px fit.

---

## 8 — Interaction & Accessibility

- The section is static disclosure inside the already-expandable panel — **no new toggles, no new tap targets.** It appears when the card is expanded (existing `aria-expanded` button, `HotelCard.tsx:512-520`) and is inside `id={detailsId}`, so it is announced as part of the expanded region.
- Structure it as `<section aria-label="Room and rate details">` containing a `<dl>` so each `dt`/`dd` pair is read as label→value by screen readers — identical to `QualityEvidencePanel`.
- The refundable "not provided — confirm before payment" line is the one advisory a screen-reader user must not miss; because it is the first `dt`/`dd` in the section and uses plain text (not color alone) to carry meaning, it is conveyed without relying on the warning color.
- Loading rows use `aria-live="polite"`; error rows are plain text within the region (not `role="alert"` — a failed rate-attribute fetch is not user-blocking; the card and CTA still function).
- Keyboard: nothing focusable is added; tab order is unchanged (Details toggle → CTA remain the only interactive elements).
- Do **not** encode any state by color alone — every state has distinct text, per the existing card's disclosure conventions.

---

## Acceptance Criteria (for UI / DEV)

1. The expanded `HotelCard` panel renders a "Room & rate details" section with four individually-labeled facts — refundable, cancellation deadline, room & bed, meal plan — in that priority order. Not one paragraph.
2. Each attribute implements all five states from §2 with the exact copy given (no placeholders, no TODO).
3. **Only `not-returned` is expected to render today.** provider-backed and provider-returned-unavailable states are coded but exercised only once a rate-shopping provider lands.
4. The single deferred sentence (`reviewDisclosure` at `HotelCard.tsx:576-577`) is removed from the expanded panel; "Price scope" + "Rate check" and the unavailable-state fallback are preserved.
5. Cancellation-deadline copy is limited to disclosure-of-absence; no policy-education surface is built here.
6. Meal-plan copy is rate-scoped in both `dt` and `dd`; no bare "Breakfast" chip; vocabulary aligned with §2.4 for future amenity-provenance coordination.
7. `HOTEL_PROVIDER_HANDOFF_COPY` is a single shared constant used by `HotelCard`, `BookingFlow`, and `deals/[dealId]`; the deals variant regains "room availability."
8. No cross-card comparison UI, no results-list refundable filter/badge, no room inventory browser is added.
9. 375px and 1280px both render the four rows without horizontal scroll and without displacing Deal Score, quality evidence, location, or price-scope.
10. No inferred/defaulted rate values; every displayed attribute is provider-sourced or explicitly "not provided."

### DEV Blocker (state plainly per Directive 7)

**Provider-backed and provider-returned-unavailable states are not implementable against Hotellook `cache.json` today.** Populating them requires:
- A new `HotelProvider`-conformant **rate-shopping** integration returning rate-level data (refundable flag, cancellation deadline, room/bed, meal plan) — a new provider contract under `lib/providers`, returning `Result<T>`, secrets from env, affiliate markers preserved.
- A `HotelOffer` type extension (`lib/types.ts:137-151`) to carry these attributes, modeled on `HotelRatingEvidence`'s `{ value?, sourceLabel?, confidence }` shape with a confidence union covering `provider_backed | provider_unavailable`.

This is **out of scope for a UI-only implementation pass.** A UI-only pass ships the `not-returned` / `loading` / `error` states against the existing (empty) data and is fully valid on its own; the provider-backed states wait on a separate DEV-track provider ticket once product/legal confirm terms for a live-rate hotel product.

---

## Handoff

This is UI-eligible work: the shipped states (`not-returned`, `loading`, `error`) are implementable in the UI layer against current data, and the shared-constant extraction is a small copy consolidation. The provider-backed / provider-returned-unavailable states are specified but blocked on provider work.

Create `UI-ROOM-RATE-CLARITY-01` for the disclosure-state implementation (new "Room & rate details" section, removal of the deferred sentence, shared handoff constant) — UI-only, no provider or type-populating work. The provider integration + `HotelOffer` extension is a separate DEV-track ticket (DEV blocker above) and must not be bundled into the UI pass.
