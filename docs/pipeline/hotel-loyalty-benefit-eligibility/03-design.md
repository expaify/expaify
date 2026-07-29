# UXDES-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01: Hotel Loyalty Benefit Eligibility — Design Spec

Date: 2026-07-29
Stage: UX Design
Priority: P2
Persona: Senior UX Designer / Interaction Designer
Ticket: UXDES-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01
Scope: one collapsed disclosure at the `/book` hotel handoff. Nothing else.
Upstream (binding): `docs/pipeline/hotel-loyalty-benefit-eligibility/02-research.md` (§5 escalation rule, §6 placement, §9 D1–D5), `01-discovery.md` (§5 constraints, §8 out of scope)
Carried forward: `docs/pipeline/loyalty-benefit-clarity/02-research.md` §2 segments, §4 claim taxonomy, §5.4 guardrails. Its §5.1/§6.1 placement recommendation is **superseded** for the hotel path.
Must not be conflated with: `docs/pipeline/rate-eligibility/` — see §10.2.

---

## 1. What is being designed, in one paragraph

One new collapsed disclosure at the hotel handoff, opened by the question the loyalty traveler is already holding — **"Will this stay earn points or status?"** — revealing a three-block routing answer: the partner owns the rate, the traveler's own program owns accrual, the property owns delivery. It asserts exactly one fact (this booking completes with a third-party partner, not the hotel brand), corrects exactly one false inference (a checkout accepting a membership number does not decide earning), and promises nothing. It costs the price-only majority one collapsed 44px row and zero network calls.

**Component:** `HotelLoyaltyEligibilityDisclosure` — new file `app/components/HotelLoyaltyEligibility.tsx`.
**Mounted:** `app/book/BookingFlow.tsx`, inside `<section aria-labelledby="hotel-provider-title">` (`:1076–1104`), directly after `HotelBookingOwnershipDisclosure` (`:1082–1087`) and before the continue anchor `<div className="mt-5 flex flex-col gap-3">` (`:1088–1103`).
**Do not modify** `app/components/HotelBookingOwnership.tsx`. It is the pattern source, not the host.

---

## 2. Hierarchy on this surface — explicit

The handoff section already has a fixed hierarchy. This disclosure enters at the bottom of it and does not disturb it.

| Rank | Element | Status after this change |
|---|---|---|
| **Primary** | Continue anchor — `Check rooms at {partner}` (`:1089–1101`) | Unchanged. Only `btn-primary` on the surface. Still the last thing before the fold-out ends. |
| **Secondary** | Section lead — "The provider confirms room details…" (`:1078–1081`) | Unchanged. |
| **Tertiary (peer row 1)** | `Who handles my booking?` trigger | Unchanged. |
| **Tertiary (peer row 2)** | `Will this stay earn points or status?` trigger — **new** | Sibling, identical weight, identical mechanics. Deliberately *not* elevated. |
| — | Expanded loyalty panel | Reachable only by user action. Never on mount. |

**Rules that enforce this:**
- The new trigger uses the same type ramp, colour, and height as the ownership trigger. No badge, no icon other than the shared chevron, no `font-semibold`, no accent border, no "Important" prefix.
- Nothing in the loyalty panel is `btn-primary` or looks like a competing call to action. The panel contains **zero links and zero buttons** — see §6.4.
- Two collapsed rows in sequence is the intended reading: an ownership map the traveler learns once and applies twice (research §6.5).

---

## 3. Anatomy and DOM

```
<div>                                   ← root, mt-4 border-t pt-3   (mirrors HotelBookingOwnership.tsx:56)
  <button aria-expanded aria-controls>  ← trigger, min-h-11         (:57–74)
    <span>Will this stay earn points or status?</span>
    <svg aria-hidden chevron>
  </button>
  {open && (
  <section id="hotel-loyalty-eligibility-panel"
           aria-labelledby="hotel-loyalty-eligibility-heading">
    <h3 id="…-heading" class="sr-only">Will this stay earn points or status</h3>
    <p>  lead                                            </p>
    <div>   ← Block 1  partner   (rate)                  </div>
    <div>   ← Block 2  program   (accrual)               </div>
    <div>   ← Block 3  property  (delivery)              </div>
  </section>
  )}
</div>
```

**Two `border-t` rows in a row is correct, not a bug.** The ownership disclosure's root already carries `mt-4 border-t … pt-3`; the loyalty root repeats it, producing a hairline rule between the two triggers. That rule is what makes them read as a list of two questions rather than one run-on block. Do not remove it, and do not add a heavier divider.

**Block order is fixed and load-bearing:** partner → program → property = rate → accrual → delivery. It walks the traveler forward in time (what you are buying → what posts afterwards → what happens at the desk) and it is the order of the §5 mnemonic. Never reorder, never make it responsive-dependent.

---

## 4. Final copy — every visible string

No placeholders. Every string below is shipping copy. Strings marked **fixed** may not be reworded by UI without returning to this stage.

### 4.1 Trigger — **fixed**

> `Will this stay earn points or status?`

Rationale (research D1): the points-collector segment will not open a row labelled as a warning but will open their own question. `Loyalty benefits`, `Important loyalty information`, and `Loyalty and rewards` are rejected. The question mark is part of the string and must not be truncated at any width (§7.1).

### 4.2 Lead sentence — **fixed**

> `expaify checks the price. It cannot confirm what a stay earns or what a property will honor.`

This is the disclosure's only self-description and it mirrors the shipped ownership line "expaify cannot access, change, cancel, or refund a reservation completed with the booking partner" (`HotelBookingOwnership.tsx:98`).

### 4.3 Block 1 — the booking partner (owns the rate)

**Heading — partner-named:**
> `{partner.label} sells this rate`

**Heading — partner-unnamed:**
> `Your booking partner sells this rate`

**Body (both cases):**
> `You are booking with a third-party partner, not with the hotel brand directly. The partner can tell you what the rate includes and whether its checkout accepts a membership number. It cannot tell you whether the stay will earn points or count toward status.`

**Closing line — the membership-number correction (D3, research §5.4). Highest-value sentence in the disclosure. May be reworded; may not be cut, and may not be moved out of Block 1:**
> `Entering a membership number at checkout passes it to the property. It does not decide whether the stay earns — your program's rules do.`

Rendered as its own `<p>` inside Block 1, in `--text-3` (the same de-emphasis the ownership card gives its secondary line at `HotelBookingOwnership.tsx:87–89`). It is a correction, not a headline: quieter than the body it qualifies, but present unconditionally in **both** the named and unnamed partner states.

Sentence 1 of the body is the **only assertion in the entire disclosure** (research §5.3). It is a structural fact about our own link contract, not a claim about any program.

### 4.4 Block 2 — your loyalty program (owns accrual)

**Heading (invariant to partner state):**
> `Your loyalty program decides what you earn`

**Body:**
> `Points and elite-night credit are set by your program's rules about the booking channel and the rate. Ask your program whether a third-party booking on this rate earns points or qualifying nights — before you book if it matters to your decision.`

Covers research §5.1 questions 1 (points) **and** 2 (elite-night credit) in one block because they share a single owner, while naming both currencies explicitly so the status re-qualifier (§2.1) is not answered only about points. "before you book if it matters to your decision" is the one time-sensitivity cue in the disclosure; it is a routing hint, not a steer — it does not tell the traveler to book, not to book, or to book elsewhere.

### 4.5 Block 3 — the property (owns delivery)

**Heading:**
> `The property decides what you get on arrival`

**Body:**
> `Status recognition, upgrades, breakfast, lounge access, and late checkout are decided by the property at check-in and depend on availability. No one can guarantee them in advance. After booking, use your confirmation to contact the property and ask what it can provide.`

Covers questions 3 and 4. "No one can guarantee them in advance" is the sentence that must survive any rewording: it is the same refusal the shipped "Special requests" block makes (`BookingFlow.tsx:1177`), and it is what stops the disclosure from reading as a hint that a good outcome is likely.

### 4.6 Screen-reader heading (not visually rendered)

> `Will this stay earn points or status`

`sr-only`, no question mark (matches `HotelBookingOwnership.tsx:77` house style for the panel's accessible name).

### 4.7 Return-reason option (D5)

> `Not sure this stay earns points or status`

Value `loyalty_or_points_uncertainty`. Inserted **before** `prefer_not_to_say`, which stays last.

*Design note, non-blocking:* the fieldset legend is `What did not match?` (`BookingFlow.tsx:1037`), and this option is an uncertainty rather than a mismatch. The label above reads acceptably under that legend and deliberately echoes the trigger copy so the two instruments can be read together. Rewriting the legend would change the meaning of five shipped options and is **out of scope for this ticket** — flagged for the pipeline owner, not for UI.

### 4.8 Strings that must not appear anywhere in this component

`Bonvoy`, `Honors`, `IHG`, `Hyatt`, `Marriott`, `Hilton`, `Genius`, `One Key`, `Trip Coins`, `earn points on this stay`, `does not earn`, `book direct`, `guaranteed`, `included`, `preserved`, `eligible for`, `may earn`, `likely`, `usually`, `most rates`. See §10.1 for the full prohibition test.

---

## 5. States

Seven states. **There is no loading, error, or empty state, and no "loyalty preserved" or "not applicable" state.** The content is static copy with zero data dependency (research §4.1) and 100% of hotel handoff targets are third-party (research §4.3). Those states are unreachable by construction. Do not implement them; do not add a prop that could produce one.

### 5.1 Collapsed — default, and the only state on mount

- `useState(false)`. No `open` prop, no `defaultOpen`, no deep-link or query-param expansion, no auto-open on scroll, intent, segment, or return-from-partner.
- Renders: root divider + trigger row only. Panel is **unmounted**, not `hidden` — matching `HotelBookingOwnership.tsx:75` (`{open ? … : null}`). This keeps the panel copy out of the a11y tree and out of Ctrl+F when collapsed, consistent with its sibling.
- Height cost: one `min-h-11` row + `mt-4 … pt-3` ≈ 44px + 28px. This is the entire tax on the price-only segment (discovery §5 constraint 3).

### 5.2 Expanded

- Panel mounts directly below the trigger. Chevron rotates 180°.
- Focus stays on the trigger. **Do not** move focus into the panel — matches the ownership disclosure, and this is non-modal supplementary content.
- No scroll-into-view, no animation of height. Only the chevron animates, and it respects `motion-reduce`.
- Re-collapse is available at any time via the same trigger.

### 5.3 Partner-named (`partner.named === true` and `partner.label` non-empty)

- Block 1 heading: `{partner.label} sells this rate`.
- Label span carries `[overflow-wrap:anywhere]` and `min-w-0` (`partnerLabelWrapCls`, `HotelBookingOwnership.tsx:5`). Labels are capped at 40 chars upstream (`BookingFlow.tsx:131–136`), but wrap defensively anyway.
- Blocks 2 and 3 are byte-identical to the unnamed state. The partner name appears **once** in the whole disclosure. Repeating it would drift toward implying the partner has authority over accrual — the exact misroute prohibited by research §5.5.

### 5.4 Partner-unnamed (`partner.named === false`, or empty label)

- Block 1 heading: `Your booking partner sells this rate`.
- Body, lead, membership correction, Blocks 2 and 3: unchanged. No extra "not sure who that is?" helper — the ownership disclosure directly above already handles that (`HotelBookingOwnership.tsx:86–90`) and repeating it here is noise.
- Resolution rule is identical to the sibling: `const named = partner.named && !!partner.label`.

### 5.5 375px (mobile)

- Trigger: one line, `justify-between`, chevron `shrink-0`. `Will this stay earn points or status?` fits at 375px in the section's padded width (`p-4`, ~343px content) at `text-sm`. **No truncation, no `line-clamp`, no ellipsis** — if it wraps to two lines that is acceptable; if it truncates, that is a defect.
- Blocks: single column, `gap-3`, card padding `px-3.5 py-3`.
- Copy wraps freely; no `whitespace-nowrap` anywhere in the component.
- Panel adds vertical length above the continue anchor. That is accepted: the anchor stays in the same DOM position, remains full-width `w-full`, and is reachable by scroll. No sticky treatment, no repositioning.
- No horizontal scroll at 375px in either state.

### 5.6 1280px (desktop)

- **Blocks stay in a single column at every breakpoint.** This is an intentional divergence from `HotelBookingOwnership.tsx:76` (`sm:grid-cols-2`): that component splits two peers, this one presents an ordered three-step routing chain. A three-column row would (a) break the partner → program → property reading order into a scan, and (b) yield ~200px columns inside the review panel, forcing 2–3 word lines on paragraphs of 40+ words.
- Do **not** add `sm:grid-cols-2` or `sm:grid-cols-3`.
- Card padding steps up to `sm:px-4 sm:py-4`, matching the sibling.
- Optional and sufficient: `max-w-[68ch]` is **not** applied — the review panel already constrains measure. Do not add width utilities.

### 5.7 Keyboard and focus

- Trigger is a real `<button type="button">`. Reachable in DOM order: ownership trigger → (ownership panel content when open) → **loyalty trigger** → (loyalty panel content when open) → continue anchor.
- `Enter` and `Space` toggle (native button behaviour — do not add `onKeyDown`).
- `Escape` does **not** collapse. This is not a modal, nothing is trapped, and `Escape` collapsing an inline region would be inconsistent with the sibling.
- Focus ring: `focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]` on the trigger — the same token used at `HotelBookingOwnership.tsx:62` and defined at `app/globals.css:84`.
- `aria-expanded={open}` and `aria-controls="hotel-loyalty-eligibility-panel"` on the trigger; the id must exist on the panel whenever `open` is true.
- Panel contains no focusable elements, so expanding never inserts a tab stop between the trigger and the continue anchor — the primary action's keyboard distance is unchanged when collapsed and grows by zero tab stops when expanded.
- Chevron `aria-hidden="true" focusable="false"`; rotation class carries `motion-reduce:transition-none`.
- Touch target ≥44px via `min-h-11` on the trigger.

---

## 6. Tailwind specification

All classes below already ship in this codebase. **No new tokens, no new colours, no new font sizes.** Tokens referenced: `--border`, `--border-hover`, `--bg-raised`, `--brand`, `--brand-hover`, `--text-1`, `--text-2`, `--text-3`, `--radius-control`, `--focus-ring` (`app/globals.css`).

### 6.1 Root
```
mt-4 border-t border-[color:var(--border)] pt-3
```

### 6.2 Trigger
```
inline-flex min-h-11 w-full items-center justify-between gap-2
rounded-[var(--radius-control)] py-2 text-left text-sm font-medium leading-6
text-[color:var(--brand)] hover:text-[color:var(--brand-hover)]
focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]
```
Chevron:
```
h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none  + (open ? 'rotate-180' : '')
```
Path: `M4 6l4 4 4-4`, `stroke="currentColor"`, `strokeWidth="1.5"`, round caps/joins, `viewBox="0 0 16 16"`, `fill="none"`.

### 6.3 Panel and blocks
```
panel:        mt-2 grid gap-3
lead <p>:     text-sm leading-6 text-[color:var(--text-2)]
block <div>:  rounded-[var(--radius-control)] border border-[color:var(--border)]
              bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4
block <h4>:   text-sm font-medium leading-5 text-[color:var(--text-1)]
              + min-w-0 [overflow-wrap:anywhere]   (Block 1 only)
body  <p>:    mt-2 text-sm leading-6 text-[color:var(--text-2)]
              + min-w-0 [overflow-wrap:anywhere]   (Block 1 only)
D3 line <p>:  mt-2 text-sm leading-6 text-[color:var(--text-3)]
sr heading:   sr-only
```
Note `grid gap-3` with **no** `sm:grid-cols-*` — see §5.6.

### 6.4 Forbidden in this component
No `btn-primary`, no `<a>`, no `<button>` other than the trigger, no `href`, no `target="_blank"`, no `rel`, no badge/pill, no `bg-[color:var(--brand-soft)]`, no warning or danger colour, no icon other than the chevron, no `shadow-[var(--shadow-card)]`, no `sticky`, no `animate-*`, no arbitrary hex, no `text-xs` (the D3 line is de-emphasised by colour, not by size — it must stay legible at 375px).

---

## 7. Interaction rules

### 7.1 Trigger
| Input | Result |
|---|---|
| Tap / click | Toggle. First open only: fire `hotel_loyalty_disclosure_opened`. |
| `Enter` / `Space` | Same as click (native). |
| Second and later opens | Toggle only. **No event.** |
| Collapse | Toggle only. No event. Panel unmounts. |
| Page re-render (e.g. funds policy resolves, invoice toggle) | Open state persists — it is component-local `useState`, and nothing above it remounts the component. UI must not key the component on `partner` or `providerUrl`. |
| Return from partner tab (`hotel_handoff_returned`) | No change. The disclosure does not open, close, highlight, or scroll. The return prompt renders elsewhere (`:1028`). |

### 7.2 Continue anchor — explicitly unchanged
Opening or ignoring the disclosure has **no effect** on the continue anchor's label, `href`, `aria-label`, `onClick`, `target`, `rel`, or enabled state. There is no gate, no confirmation, no interstitial, no "I understand" checkbox. The disclosure never blocks the handoff.

### 7.3 Errors and retries
None exist. There is no fetch, no async work, no derived state that can fail, and therefore no retry affordance. If a UI implementer finds themselves adding a `try`/`catch`, a load state, or a fallback string, they have exceeded this spec.

---

## 8. Instrumentation (D5)

### 8.1 `hotel_loyalty_disclosure_opened`

- Fires **once per component lifetime**, on the first closed→open transition, via a `useRef(false)` guard identical to `HotelBookingOwnership.tsx:40, 44–53`. Second open in the same session fires nothing.
- Wired as `onOpen` prop → `handleLoyaltyDisclosureOpen` in `BookingFlow.tsx`, modelled on `handleBookingOwnershipOpen` (`:966–974`).
- Props: `{ source, partnerHost, partnerNamed, handoffSessionId }` — `source: analyticsProps.source`, `partnerHost: analyticsProps.partnerHost`, `partnerNamed: partner.named`.

**⚠ Sequencing correction to research D5 — read before implementing.**
`handoffSessionIdRef` is `undefined` until the continue click assigns it (`BookingFlow.tsx:845`, `:930–932`). The disclosure is opened *before* continue, so on the common path `handoffSessionId` on this event is `undefined`. Research §8.2 wants open-rate segmented against `hotel_handoff_continue_clicked`; passing an undefined id cannot deliver that. Resolution, using the pattern already shipped for `helpViewed`:

1. Still send `handoffSessionId: handoffSessionIdRef.current` (populated only if the traveler continued, returned, and re-opened — harmless and occasionally useful). Do not fabricate an id, and do not move id generation earlier: `hotel_handoff_return_reason_selected` depends on the id being minted at continue, and changing that would alter a shipped instrument.
2. Add `loyaltyDisclosureViewed: <boolean>` to the existing `hotel_handoff_continue_clicked` payload (`:933–939`), tracked by a `loyaltyViewedRef` set in `handleLoyaltyDisclosureOpen` — exactly how `helpViewedRef` / `helpViewed` works today (`:734`, `:938`). This is what actually makes §8.2's open-rate-vs-continue segmentation computable.

This is an additive property on an existing event; no existing property changes name, type, or meaning.

### 8.2 Return reason
- Extend the `HotelReturnReason` union (`:35–40`) with `'loyalty_or_points_uncertainty'`.
- Insert into `HOTEL_RETURN_REASONS` (`:42–48`) at index 4 — after `other_hotel_details_mismatch`, **before** `prefer_not_to_say`.
- Label per §4.7. `hotel_handoff_return_reason_selected` needs no other change; it already carries `handoffSessionId` (`:960`).

### 8.3 Nothing else
No exposure/impression event, no dwell timer, no close event, no scroll depth. Open rate and the return reason are the two signals §8.2 of the research needs to falsify the ship decision; anything more is surveillance without a question attached.

---

## 9. Component contract for UI

```ts
export type HotelLoyaltyEligibilityPartner = {
  /** Display label already resolved by getHotelPartnerIdentity. */
  label: string
  /** True only when the host matched a known partner domain. */
  named: boolean
}

export type HotelLoyaltyEligibilityDisclosureProps = {
  partner: HotelLoyaltyEligibilityPartner
  /** Fires once, on the first closed → open transition. */
  onOpen?: () => void
}
```

- Props are exactly these two. **No** `offer`, `hotelContext`, `rateEligibility`, `membershipLabel`, `providerUrl`, `open`, `defaultOpen`, `variant`, or `surface`.
- UI may reuse `HotelBookingOwnershipPartner` by structural compatibility rather than importing it; either is fine, but **do not edit `HotelBookingOwnership.tsx`** to export a shared type — a shared-type refactor is not in this ticket.
- No exports are renamed or removed anywhere.

Mount site:
```tsx
<HotelBookingOwnershipDisclosure … />           {/* :1082–1087, unchanged */}
<HotelLoyaltyEligibilityDisclosure
  partner={partner}
  onOpen={handleLoyaltyDisclosureOpen}
/>
<div className="mt-5 flex flex-col gap-3">      {/* :1088, unchanged */}
```

---

## 10. Prohibitions and scope — the hard-fail checklist

### 10.1 Copy prohibitions (research §5.5 / D4)
1. ❌ Any positive earning or benefit claim ("earn points on this stay", "elite benefits included", any ✓-preserved state).
2. ❌ Any per-brand or per-rate negative ("this rate does not earn points", "third-party rates never earn"). Stay at unknown; never flip to a false no.
3. ❌ Any "book direct to keep your benefits" steer, or any comparison of channels by benefit.
4. ❌ Any named brand loyalty program (Bonvoy, Honors, IHG One, World of Hyatt) or marketplace currency (Genius, One Key, Trip Coins).
5. ❌ Any copy implying the **partner** can confirm accrual or elite-night credit (misroutes questions 1–2).
6. ❌ Any copy implying the **program** can confirm an upgrade or on-property perk (misroutes question 4).
7. ❌ Hedges that imply a probability we have not sourced: "may earn", "usually", "likely", "most rates".

### 10.2 Scope prohibitions
1. ❌ No new field on `HotelOffer`.
2. ❌ No read of, reference to, or extension of `rateEligibility`, `rateEligibilityCapability`, or `membershipLabel`. The shipped fixture for that field literally holds `'GENIUS LOYALTY'` (`lib/hotels/__tests__/rateEligibility.test.ts:221–225`) while answering a completely different question — "may I buy this rate?" — so reading it here would produce a confidently wrong statement from a tested code path (research §3).
3. ❌ No network call, no provider method, no API route, no cache key. Copy is static and provider-agnostic.
4. ❌ No collection, storage, or transmission of a loyalty/membership number.
5. ❌ No change to `HotelCard.tsx`, `DealCard.tsx`, `CompareRow.tsx`, `HotelDealCriteria.tsx`, `app/deals/[dealId]/page.tsx`, `lib/pipeline/otaLinks.ts`, or the deals feed.
6. ❌ No change to `HotelBookingOwnership.tsx`.
7. ❌ Affiliate contract untouched: `HOTEL_AFFILIATE_ID` markers, `rel="noopener noreferrer sponsored"` (`:1092`), `isAttributedHotelProviderUrl` gating (`CompareRow.tsx:35`), and the continue `href` are all unmodified.

**Expected diff for the UI stage:** `app/components/HotelLoyaltyEligibility.tsx` (new), `app/book/BookingFlow.tsx` (mount + handler + `loyaltyViewedRef` + `loyaltyDisclosureViewed` prop + return-reason union/list), and tests. Nothing else.

---

## 11. Acceptance tests

Every test below is objectively checkable. UI must pass 1–14 before creating the TEST ticket.

**Placement and default**
1. On mount of the hotel handoff, `hotel-loyalty-eligibility-panel` is not in the DOM.
2. The trigger renders between the ownership disclosure and the continue anchor, inside `section[aria-labelledby="hotel-provider-title"]`.
3. No loyalty string appears on `app/deals/[dealId]/page.tsx`, `HotelCard`, `DealCard`, `CompareRow`, or the deals feed.

**Copy and routing**
4. Expanded panel contains the lead, three blocks, and the D3 membership line — all six §4 strings, verbatim or within an approved rewording.
5. Each of the four research §5.1 questions maps to exactly one block: points → Block 2, elite-night credit → Block 2, status recognition → Block 3, upgrade/breakfast/lounge/late checkout → Block 3, rate mechanics + membership-number handling → Block 1.
6. A reader shown only the panel can state who to ask about points and who to ask about an upgrade, and gives **different** answers.
7. A reader told "the checkout accepted my membership number" correctly says that does not confirm earning.
8. Grep of the new component for the §4.8 string list returns zero hits.

**States**
9. Partner-named: Block 1 heading is `{partner.label} sells this rate`; the label appears exactly once in the whole panel.
10. Partner-unnamed: Block 1 heading is `Your booking partner sells this rate`; Blocks 2–3 and the D3 line are byte-identical to the named state.
11. At 375px: no horizontal scroll collapsed or expanded; the trigger's `?` is not truncated; no text overlaps; the continue anchor is full-width and reachable.
12. At 1280px: blocks render one per row (no multi-column), copy measure is comfortable, and no layout shift occurs in the surrounding section on toggle.

**Keyboard / a11y**
13. Tab order is ownership trigger → loyalty trigger → continue anchor when collapsed; expanding adds **zero** tab stops. `Enter` and `Space` both toggle. Focus ring is `--focus-ring` and stays on the trigger after toggling. `aria-expanded` flips; `aria-controls` resolves to a present id when open.

**Instrumentation**
14. Open twice in one session → exactly one `hotel_loyalty_disclosure_opened`, carrying `source`, `partnerHost`, `partnerNamed`. Continue after opening → `hotel_handoff_continue_clicked` carries `loyaltyDisclosureViewed: true`; continue without opening → `false`. Selecting the new return reason emits `hotel_handoff_return_reason_selected` with `reason: 'loyalty_or_points_uncertainty'` and a defined `handoffSessionId`. `prefer_not_to_say` is still the last option.

**Regression**
15. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0; existing `BookingFlow` and hotel handoff tests pass unchanged except for the additive return-reason list.

---

## 12. Post-ship exit criterion (carried from research §8.2)

Retire the disclosure if, after a reasonable observation window, **both** hold: (a) open rate at the handoff is negligible — retest the trigger wording once (§4.1) before retiring; and (b) `loyalty_or_points_uncertainty` surfaces no meaningful share of hotel handoff abandonment. If retired, keep the §4 routing copy as internal support guidance. This is a committed exit, not a hypothetical.

---

## 13. Handoff — for UI-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01

Build `app/components/HotelLoyaltyEligibility.tsx` to §3/§6/§9, mount it per §9, wire §8 instrumentation including the **§8.1 sequencing correction**, and pass §11.1–15. Copy in §4 is final — strings marked **fixed** may not be reworded. Design no state outside §5: there is no loading, error, empty, "loyalty preserved", or "not applicable" state, and adding one is a spec violation, not an improvement.

**Open item for the pipeline owner (not for UI):** the return-prompt legend `What did not match?` (`BookingFlow.tsx:1037`) frames all six options as mismatches, while the new option is an uncertainty (§4.7). Rewording the legend touches five shipped options and belongs in its own ticket.
