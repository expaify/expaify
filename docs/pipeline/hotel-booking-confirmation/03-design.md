# UXDES-HOTEL-BOOKING-CONFIRMATION-01: Hotel Booking Confirmation and Itinerary Access — Design Spec

**Stage:** UX Design (UXDES)
**Date:** 2026-08-03
**Priority:** P1
**Persona:** Senior UX Designer / Interaction Designer
**Upstream:** `docs/pipeline/hotel-booking-confirmation/02-research.md` → `01-discovery.md`
**Downstream:** `UI-HOTEL-BOOKING-CONFIRMATION-01`

**Source files this spec targets:** `app/book/BookingFlow.tsx`, `app/book/page.tsx`, `app/api/book/hotel-context/route.ts`, `app/api/analytics/route.ts`, plus one new module `lib/booking/hotelStayStore.ts`.

---

## 0. The one rule that governs every string in this document

expaify never observes a hotel reservation. Every visible string in every state below is one of exactly four kinds:

| Kind | Permitted phrasing | Example |
|---|---|---|
| **Observed by expaify** | plain assertion | "The rate expaify showed was $184.00 per night." |
| **Declared by the traveler** | attributed, always | "You told us you booked this stay on 3 Aug 2026." |
| **Held by the partner** | attributed to partner | "Booking.com holds this reservation." |
| **Not known to expaify** | explicit denial | "expaify was not told the deadline for this rate." |

Forbidden in every hotel state: "confirmed", "your booking", "your reservation is", "booked successfully", any confirmation number placeholder, any check-mark or green success tone applied to a reservation. Green (`--success`) is not used anywhere in this feature. The declaration states use neutral surface tone (`--bg-raised` / `--border`), never `--success-soft`.

---

## 1. Architecture of the surface

### 1.1 Where the return state mounts (D1)

`ReviewShell` accepts `hotelSupplement` and never renders it (`BookingFlow.tsx:543`, `:558-570`). **This spec does not fix that prop and does not remove it** — the dead `TrackedSmokingPolicyPanel surface="review"` belongs to `hotel-smoking-policy`. Removing the prop would silently delete that ticket's evidence.

Instead: the return state is passed to `ReviewShell` as **`status`**, which the hotel branch already renders directly beneath `HotelDecisionSummary` and above `{children}` (`:565-567`). This places it above the "Check rooms at {partner}" section at every breakpoint with zero shell restructuring.

```
<main max-w-[1080px]>
  ← Back to results
  HotelDecisionSummary          (property, price, deal score, fit)
  {status}  ←── RETURN STATE / RECOGNISED-RETURN STATE MOUNTS HERE
  {children}                    (Check rooms with provider → handoff CTA)
                                (Supporting evidence)
</main>
```

The return state must **not** be gated on `policy` being truthy. Today the whole block sits inside `hotelSupplement={policy ? ... : undefined}` (`:1121`). The new state renders whenever its own condition is true, independent of smoking-policy evidence.

### 1.2 State machine

One state variable replaces `showReturnPrompt`:

```ts
type HotelReturnPhase =
  | 'none'          // pre-handoff, no stub, first visit
  | 'asking'        // returned from partner, outcome not declared
  | 'declared'      // traveler declared "I booked" this session
  | 'recognized'    // a stored stub for this offerId was found on mount
```

| From | Trigger | To |
|---|---|---|
| `none` | mount, `readStayStub(offerId)` returns a stub | `recognized` |
| `none` | `visibilitychange` → hidden → visible after continue click | `asking` |
| `asking` | "I booked" | `declared` (+ write stub) |
| `asking` | "I didn't book" | `none` (+ reveal tertiary mismatch link) |
| `declared` / `recognized` | reload with stub present | `recognized` |

`recognized` wins over `asking` on mount. Once `declared`, a return trip to the partner ("Open {partner} again" → return) does **not** drop back to `asking`; it stays `declared`.

`'none'` after "I didn't book" is byte-identical to a first visit except that the tertiary mismatch link (§5.4) is now present.

---

## 2. Hierarchy

On the return screen, top to bottom:

1. **Primary — the return state** (`status` slot). What happened, and what to save. Only element that takes focus on appearance.
2. **Secondary — `HotelDecisionSummary`** above it. Unchanged; it is the "which stay is this" anchor and is already at the top of the shell.
3. **Tertiary — the handoff section** below. Demoted: the CTA loses `btn-primary` and takes `secondaryButtonCls`.
4. **Quaternary — the mismatch survey.** Reachable only from the "I didn't book" branch, minimum two interactions from the return state. Never shown to a traveler who declared they booked.
5. **Supporting evidence** section unchanged.

Within the return state, in DOM and reading order: heading → provenance line → (branch content) → offer reference → ownership line → actions.

---

## 3. Shared visual language

All classes reuse existing constants in `BookingFlow.tsx:100-106`. No new colours, no new font sizes.

| Token role | Class |
|---|---|
| Return-state panel | `panelCls` + `border-[color:var(--border-strong)] p-4 sm:p-6` |
| Inner block (checklist, offer ref) | `insetPanelCls` + `p-3.5 sm:p-4` |
| Eyebrow | `text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]` |
| State heading (h2) | `text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl outline-none` |
| Sub-heading (h3) | `text-sm font-medium leading-5 text-[color:var(--text-1)]` |
| Body | `text-sm leading-6 text-[color:var(--text-2)]` |
| Fact label | `factLabelCls` |
| Provenance line | `text-xs font-medium leading-5 text-[color:var(--text-3)]` |
| Partner name in running text | wrap in `<span className={partnerLabelWrapCls}>` |
| Mono value (offerId) | `mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]` |
| Primary action in this feature | `btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium sm:w-auto` |
| Secondary action | `secondaryButtonCls` (already `w-full`; add `sm:w-auto`) |
| Tertiary link-button | `inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--brand)] underline underline-offset-2 focus-visible:shadow-[var(--focus-ring)]` |
| Action row | `mt-4 flex flex-col gap-3 sm:flex-row` |

**Focus:** every interactive element carries `focus-visible:shadow-[var(--focus-ring)]` (present in `btn-primary` and `secondaryButtonCls` already). Minimum target height `min-h-11` (44px) everywhere, including the tertiary link.

**Announcement pattern (used by every state that appears after mount):**

```tsx
<section aria-labelledby="hotel-return-title" className={...}>
  <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  <h2 id="hotel-return-title" ref={headingRef} tabIndex={-1} className="...outline-none">{heading}</h2>
  ...
</section>
```

The live region is a **separate sr-only node**, not the panel itself. Reason: D1 requires both `role="status"` and focus-to-heading; putting `aria-live` on the panel would make a screen reader read the whole panel from the live region and then read it again from the focus move. The sr-only node announces one short sentence; the focus move then reads the heading and lets the user walk the content. `headingRef.current?.focus()` runs in a `useEffect` keyed on the phase transition, guarded by a ref so it fires once per transition.

---

## 4. Data: the stay stub (D4)

New module `lib/booking/hotelStayStore.ts`. Client-only, `localStorage`, no server, no schema change.

```ts
export const HOTEL_STAY_STORE_KEY = 'expaify.hotelStay.v1'
export const HOTEL_STAY_STORE_LIMIT = 10
export const HOTEL_STAY_RETENTION_DAYS = 180

export type HotelStayStub = {
  v: 1
  offerId: string
  provider: string
  partnerHost: string
  partnerLabel: string      // '' when partner.named is false
  name: string
  areaLabel: string         // getHotelLocationDisplay(...).value, '' if absent
  priceCents: number        // integer, the rate expaify SHOWED
  currency: string          // 3-letter
  priceBasis: 'per_night_before_taxes_fees'
  providerUrl: string       // affiliate marker intact
  declaredBookedAt: string  // ISO 8601, expaify's clock
  handoffAttemptId: string
  checkIn?: string
  checkOut?: string
  nightCount?: number
}
```

API — every function returns a `Result`-shaped value or a plain fallback and **never throws**:

```ts
readStayStub(offerId: string): HotelStayStub | null          // null on any parse/quota/availability failure
writeStayStub(stub: HotelStayStub): { ok: true } | { ok: false; reason: string }
isStayStorageAvailable(): boolean                             // probe write+remove of a throwaway key
```

Rules:

- **Cap 10.** On write, if the list holds 10 entries and none matches `offerId`, evict the single oldest by `declaredBookedAt`. A write for an existing `offerId` replaces in place and does not evict.
- **Expiry on read.** Drop a stub when `now > checkOut + 180d` (dates present) or `now > declaredBookedAt + 180d` (dates absent). Pruning happens on read and before write.
- **Corrupt or foreign data** (unparseable JSON, `v !== 1`, missing required key, `priceCents` non-integer, `currency` not `/^[A-Z]{3}$/`) → treat the whole store as absent and overwrite on the next successful write. Never surface a parse error to the traveler.
- **Never stored:** traveler name, email, phone, confirmation number, price paid, any partner-sourced value. The stub holds only what expaify displayed plus one boolean-equivalent declaration.
- `priceCents` is displayed only under the label "Rate expaify showed" — never "amount paid", never "total".

**No `bookings` table, no `/api/account` route, no change to `lib/db/schema.sql`** (it carries unresolved conflict markers at `:272`, `:395`, `:408` and is not valid SQL). **No change to `HOTEL_CONTEXT_TTL_SECONDS`** — that store's job is one navigation; post-handoff declared data does not belong in a 30-minute cache.

---

## 5. States

Partner naming: every state has a **named** and an **unnamed** variant. Unnamed is `partner.named === false` → substitute the exact strings in the Unnamed column. Nothing else changes between the two.

### 5.1 S0 — Pre-handoff (baseline, first visit)

Unchanged from today except one copy correction.

**Change:** the collapsed `<details>` at `BookingFlow.tsx:1327-1334` keeps its position but its helper line is replaced.

| | Copy |
|---|---|
| Summary | `Show offer details` *(unchanged)* |
| Label | `expaify offer reference` *(was "Offer reference")* |
| Value | `{hotelContext.offerId}` — `break-all font-mono` |
| Helper | `Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.` |

Rationale: the previous helper ("Use this reference if you contact expaify support") lets a traveler read an offer id as a booking reference. The corrected string denies that explicitly, and it is the same string used in every post-return state so the meaning never shifts.

`showReturnPrompt`'s old panel inside `hotelSupplement` is deleted. The nine `HOTEL_RETURN_REASONS` and `handleReturnFeedback` are **kept unchanged** and re-mounted at §5.4.

---

### 5.2 S1 — Return state, outcome question (D1 + D2)

Renders when `phase === 'asking'`. Mounts in the `status` slot.

**Trigger:** unchanged `visibilitychange` listener (`:980-1008`). It keeps emitting `hotel_handoff_returned`. `awayDurationBucket` continues to be sent and **must not** gate rendering, order, wording, or any preselection — a 3-second bounce and a completed checkout render byte-identical markup.

**Copy:**

| Element | Named partner | Unnamed |
|---|---|---|
| sr-only announcement | `Back from Booking.com. Tell expaify what happened so it can show the right next step.` | `Back from the booking partner. Tell expaify what happened so it can show the right next step.` |
| Eyebrow | `After the handoff` | same |
| H2 | `Back from Booking.com` | `Back from the booking partner` |
| Body | `expaify does not receive your reservation from Booking.com. Tell us what happened so we can show you the right next step.` | `expaify does not receive your reservation from the booking partner. Tell us what happened so we can show you the right next step.` |
| Button A (primary) | `I booked` | `I booked` |
| Button B (secondary) | `I didn't book` | `I didn't book` |
| Helper under buttons | `Your answer stays in this browser. expaify does not send it to Booking.com and cannot check it.` | `Your answer stays in this browser. expaify does not send it to the booking partner and cannot check it.` |

**Layout — 375px:** panel full width inside the shell's `px-4`. Buttons stack, each `w-full min-h-11`, `gap-3`. Heading wraps at two lines max for the longest known partner label (40-char cap in `getHotelPartnerIdentity`); heading gets `break-words`, partner label inside `partnerLabelWrapCls`.
**Layout — 1280px:** panel is the shell's full `max-w-[1080px]` column. Buttons side by side (`sm:flex-row`), each `sm:w-auto`, left-aligned. Body text `max-w-2xl`.

**Handoff CTA while `asking`:** demoted. `btn-primary` → `secondaryButtonCls`; label `Check rooms at Booking.com` → **`Open Booking.com again`** (unnamed: **`Open the booking partner again`**). `href={hotelContext.providerUrl}` unchanged — affiliate marker intact, `rel="noopener noreferrer sponsored"` unchanged. Accessible name recomputed with the new label; the rest of `accessibleName` (`:1110`) is unchanged.

**Keyboard:** Tab order into the panel is heading (focused programmatically, `tabIndex={-1}`, not in the tab ring afterward) → `I booked` → `I didn't book` → helper text (non-focusable) → onward to the demoted CTA. Both buttons are `<button type="button">`, so Enter and Space both activate natively. No `div` with `onClick`.

**Screen reader order:** announcement → "Back from Booking.com, heading level 2" → body → "I booked, button" → "I didn't book, button" → helper.

**Focus on appearance:** `document.activeElement` is the H2 after the phase becomes `asking`.

---

### 5.3 S2 — "I booked" declared (D2 + D3 + D5b)

Renders when `phase === 'declared'`. Replaces S1 in place (same `status` slot, same panel), so the traveler's answer is not left on screen as an unanswered question.

On entry, in this order: write the stub (§4) → set phase → announce → move focus to the H2.

**Copy — header block:**

| Element | Named | Unnamed |
|---|---|---|
| sr-only announcement | `Saved in this browser. Four details to copy from Booking.com now.` | `Saved in this browser. Four details to copy from the booking partner now.` |
| Eyebrow | `After the handoff` | same |
| H2 | `You told us you booked this stay` | same |
| Provenance line (directly under H2) | `You told us you booked this on 3 Aug 2026, 2:14 PM. expaify has not confirmed this with Booking.com.` | `…expaify has not confirmed this with the booking partner.` |
| Stay line — **dates present** | `Fri, Aug 14 → Sun, Aug 16, 2026 · 2 nights` | same |
| Stay line — **dates absent** | `Stay dates were not provided for this offer.` | same |
| Rate line | `Rate expaify showed: $184.00 per night` | same |

Date/time formatting: reuse `formatDateTime` (`BookingFlow.tsx:241`) for the stay dates. `declaredBookedAt` needs the year, which `formatDateTime` omits, so add a sibling `formatDeclaredAt(iso)` using `toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })`, returning the raw ISO string if `Date.parse` fails. Money uses the existing `formatMoney(priceCents, currency)`. No float ever reaches the view.

**Copy — capture checklist (D3):**

| Element | Named | Unnamed |
|---|---|---|
| H3 | `Save these from Booking.com now — expaify cannot retrieve them later.` | `Save these from the booking partner now — expaify cannot retrieve them later.` |
| Item 1 term | `Confirmation number` | same |
| Item 1 detail | `On Booking.com's confirmation page and in its email. expaify never receives this.` | `On the booking partner's confirmation page and in its email. expaify never receives this.` |
| Item 2 term | `Cancellation deadline` | same |
| Item 2 detail | `Booking.com set this at checkout. expaify was not told the deadline for this rate.` | `The booking partner set this at checkout. expaify was not told the deadline for this rate.` |
| Item 3 term | `Property phone number` | same |
| Item 3 detail | `On Booking.com's confirmation. Use it to reach the property directly.` | `On the booking partner's confirmation. Use it to reach the property directly.` |
| Item 4 term | `The email address you used` | same |
| Item 4 detail | `Your confirmation goes there. Check spam if it has not arrived within an hour.` | same |
| Ownership line (below list) | `Booking.com holds this reservation. expaify cannot look it up, change it, or cancel it.` | `The booking partner holds this reservation. expaify cannot look it up, change it, or cancel it.` |

Markup: `<dl>` with four `<div><dt>term</dt><dd>detail</dd></div>` pairs. **No `<input>`, `<select>`, `<textarea>`, or checkbox anywhere in this block** — expaify collects none of these values and cannot verify completion, so nothing implies it has. Items are numbered visually with a `<span aria-hidden="true">` counter only; the `<dl>` carries the semantics.

**Copy — offer reference (relocated, uncollapsed):**

| Element | Copy |
|---|---|
| Label | `expaify offer reference` |
| Value | `{hotelContext.offerId}` |
| Helper | `Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.` |

Rendered in an `insetPanelCls` block immediately below the ownership line. **No `<details>` ancestor.** Value is `break-all font-mono` and user-selectable (no `select-none`, no truncation).

**Copy — storage-unavailable variant (D4):** when `writeStayStub` returns `{ ok: false }` or `isStayStorageAvailable()` is false, everything above still renders in full, plus one line directly beneath the offer reference:

> `This browser is not saving the stay. Copy the details above before you close this tab.`

Styling: `text-sm leading-6 text-[color:var(--text-2)]` inside the same inset block. **No error tone, no red, no alert role, no icon.** The traveler did nothing wrong and there is no action to take beyond what the checklist already says. Nothing else in the state changes — the checklist and offer reference are exactly as durable as the tab, which is the honest framing.

**Actions:**

| Action | Style | Copy | Behaviour |
|---|---|---|---|
| Primary | `btn-primary` | `Back to results` | `href="/"`, same as the shell's back link |
| Secondary | `secondaryButtonCls` | `Open Booking.com again` / `Open the booking partner again` | `href={providerUrl}` `target="_blank"` `rel="noopener noreferrer sponsored"` |

The handoff section below (`children`) keeps its own demoted CTA from §5.2. It is never removed — booking a second room is legitimate.

**Layout — 375px:** single column throughout. `<dl>` is one column, `<dt>` above `<dd>`, `gap-3` between pairs; detail text carries `[overflow-wrap:anywhere]` so a long partner label cannot force horizontal scroll. Offer reference wraps mid-token via `break-all`. Actions stack full width.
**Layout — 1280px:** `<dl>` stays **one column** — these are four sequential instructions, and a 2×2 grid breaks the "in this order" reading. Panel body `max-w-2xl`; actions in a row.

**Keyboard:** H2 (programmatic focus) → `Back to results` → `Open {partner} again` → onward. Nothing inside the checklist is focusable.
**Screen reader order:** announcement → H2 → provenance → stay line → rate line → checklist H3 → four term/detail pairs → ownership line → offer reference label/value/helper → (storage line) → actions.

---

### 5.4 S3 — "I didn't book"

Returns to `phase === 'none'`. The return-state panel unmounts entirely. `HotelDecisionSummary`, the handoff section, and the CTA are restored to the S0 first-visit rendering — **the CTA label reverts to `Check rooms at Booking.com` and `btn-primary`**, so a traveler who bounced sees no residue of the question.

Focus moves to the restored handoff CTA (`<a href={providerUrl}>`), not to `document.body` — otherwise a keyboard user is dropped at the top of the document after an action taken mid-page.

One addition, rendered inside the handoff section directly beneath the CTA's `newTabCue` line:

| Element | Named | Unnamed |
|---|---|---|
| Tertiary link-button | `Something didn't match on Booking.com` | `Something didn't match on the booking partner` |

Activating it opens the existing mismatch survey (`feedbackOpen` → the unchanged `HOTEL_RETURN_REASONS` fieldset, `handleReturnFeedback`, `hotel_handoff_return_reason_selected`, and the unchanged "Thanks. Your feedback was recorded." confirmation). The survey renders inline below the link, not in the `status` slot.

This is why the survey is **at minimum two interactions** from the return state ("I didn't book" → "Something didn't match…"): a traveler who just paid is never asked about expaify's price accuracy, and a traveler who bounced can still tell us why.

**Keyboard:** the link-button is a `<button type="button">` with `min-h-11`. On cancel, focus returns to it via the existing `feedbackTriggerRef` pattern (`:1157`).

---

### 5.5 S4 — Recognised return, inline path (D5)

Renders when `phase === 'recognized'` — i.e. `readStayStub(hotelContext.offerId)` returned a stub on mount. Occupies the `status` slot. This is what a traveler sees when they re-enter the `/book` URL hours or days later.

| Element | Named | Unnamed |
|---|---|---|
| sr-only announcement | `You told us you booked this stay on 3 Aug 2026.` | same |
| Eyebrow | `Earlier from this browser` | same |
| H2 | `You told us you booked this stay` | same |
| Provenance | `You told us you booked this on 3 Aug 2026, 2:14 PM. expaify has not confirmed this with Booking.com.` | `…with the booking partner.` |
| Stay line — dates present | `Fri, Aug 14 → Sun, Aug 16, 2026 · 2 nights` | same |
| Stay line — dates absent | `Stay dates were not provided for this offer.` | same |
| Rate line | `Rate expaify showed: $184.00 per night` | same |
| Where-it-lives line | `Your confirmation is in Booking.com's email. expaify has no copy of it.` | `Your confirmation is in the booking partner's email. expaify has no copy of it.` |
| Offer reference | label / value / helper exactly as §5.3 | same |
| Secondary action | `Open Booking.com again` | `Open the booking partner again` |
| Primary action | `Back to results` | same |

**Double-booking guard.** The handoff section below is *not* hidden. Its CTA takes `secondaryButtonCls` and:

| Element | Named | Unnamed |
|---|---|---|
| CTA label | `Book this again` | `Book this again` |
| Line directly above the CTA | `You already told us you booked this stay on 3 Aug 2026. Booking again creates a second reservation with Booking.com.` | `…creates a second reservation with the booking partner.` |

Styling of that line: `text-sm font-medium leading-6 text-[color:var(--warning)]` — warning tone, matching the existing "Last-checked time not provided." treatment (`:401`). Not an alert, no live region: it is present from mount, so it is read in normal document order.

The checklist from §5.3 is **not** repeated here. On a later visit the traveler no longer has the partner confirmation on screen, so "save these now" would be false urgency. What they need is the offer reference and where the confirmation lives.

**Focus:** H2 receives focus on mount, matching D1 and matching `InvalidHotelState`'s existing pattern.
**Layout 375px / 1280px:** identical structure to §5.3 minus the checklist. At 375px the state renders above `HotelDecisionSummary`'s content with `space-y-4` shell spacing and no overlap; the shell's `min-w-0` on inner containers is preserved.

---

### 5.6 S5 — Recovery from an expired context reference (D5)

Today: a reference-path offer past `HOTEL_CONTEXT_TTL_SECONDS` renders `InvalidHotelState` (`:688-732`) — assertive red, "We can't identify this hotel", single "Back to search". For a traveler who may have just paid, that is a dead end.

**Prerequisite change (UI-owned, one line):** `app/api/book/hotel-context/route.ts:22` appends the offer id to the returned href so the client can recover:

```
/book?kind=hotel&hotelContextRef=<ref>&offerId=<encodeURIComponent(offerId)>
```

`offerId` is read from the validated context, not from the raw request body. `app/book/page.tsx` passes the raw `offerId` param through to `BookingFlow` as a new optional prop `recoveryOfferId?: string`; the server does not read `localStorage` and does not resolve it.

**Behaviour:** when `invalidHotelSelection === true` **and** `recoveryOfferId` is present **and** `readStayStub(recoveryOfferId)` returns a stub → render the **stub-only recovery state** instead of `InvalidHotelState`. When any of those is false → `InvalidHotelState`, with one added line (below).

The recovery state cannot use `ReviewShell`'s hotel branch (there is no `hotelContext`), so it renders as a standalone `<main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">` with the same back link, containing one `panelCls` panel:

| Element | Copy |
|---|---|
| sr-only announcement | `This page's offer details have expired. expaify still has what you told it about this stay.` |
| Eyebrow | `Earlier from this browser` |
| H2 | `You told us you booked this stay` |
| Provenance | `You told us you booked this on 3 Aug 2026, 2:14 PM. expaify has not confirmed this with Booking.com.` |
| Hotel name | `{stub.name}` — `break-words font-display text-2xl font-bold` |
| Area | `{stub.areaLabel}` — omitted entirely when `''` |
| Stay line | dates present / absent variants exactly as §5.3 |
| Rate line | `Rate expaify showed: $184.00 per night` |
| Expiry explanation | `The full offer details for this page have expired. expaify keeps offer pages for 30 minutes.` |
| Where-it-lives line | `Your confirmation is in Booking.com's email. expaify has no copy of it.` |
| Offer reference | label / value / helper exactly as §5.3 |
| Secondary action | `Open Booking.com again` → `href={stub.providerUrl}`, `target="_blank"`, `rel="noopener noreferrer sponsored"` |
| Primary action | `Back to search` → `href="/"` |

The re-issued link uses `stub.providerUrl` verbatim, so the affiliate marker written at handoff time is preserved byte-for-byte and still satisfies `isValidatedAffiliateProviderUrl`. **A stub whose `providerUrl` fails that check renders without the "Open … again" action** rather than emitting an unmarked outbound link — the rest of the state is unaffected.

Tone: neutral (`--border`, `--bg-raised`). Not red. Nothing failed from the traveler's side.

**No-stub case — `InvalidHotelState` gains exactly one line**, placed inside the "What happens now" inset directly above the "Back to search" action, keeping the existing assertive `StatusPanel` and focus behaviour untouched:

> `If you booked a hotel from this page, your reservation is with the booking partner. Check your email for its confirmation.`

Styling `text-sm leading-6 text-[color:var(--text-2)]`. No claim, no lookup offered, no support address.

---

## 6. Variant matrix

Every cell must be implemented. "—" means the state cannot occur.

| | dates present | dates absent | storage unavailable | partner unnamed |
|---|---|---|---|---|
| S1 asking | n/a (no stay line) | n/a | renders identically; declaration will fail at S2 | §5.2 Unnamed column |
| S2 declared | stay line with dates | `Stay dates were not provided for this offer.` | + `This browser is not saving the stay. Copy the details above before you close this tab.` | §5.3 Unnamed column |
| S3 not booked | n/a | n/a | n/a | tertiary link Unnamed copy |
| S4 recognized | stay line with dates | `Stay dates were not provided for this offer.` | — (state requires a stub, which requires storage) | §5.5 Unnamed column |
| S5 recovery | stay line with dates | `Stay dates were not provided for this offer.` | — (falls through to `InvalidHotelState` + added line) | §5.6, "the booking partner" |

**A blank stay line is never acceptable, and a date is never inferred** — not from `nightCount` alone, not from `priceCheckedAt`, not from "today".

---

## 7. Blocking dependency: stay dates

`checkIn` / `checkOut` / `nightCount` are absent for **two independent reasons**, and fixing either alone changes nothing on screen:

1. `buildBookingHotelContext(hotel, continuity?)` honours `continuity` (`lib/booking/config.ts:1233`, `:1269-1277`) but **both call sites omit the argument** — `lib/booking/config.ts:1370` and `app/components/HotelCard.tsx:902`.
2. `HotelDecisionSummary` hardcodes the "Stay dates not provided" panel (`BookingFlow.tsx:383-388`) and never reads `hotelContext.checkIn`.

Both are owned by `hotel-booking-handoff-trust`, not by this ticket.

**Consequence for UI:** implement S1–S5 now. The dates-present branch of every stay line is written, typed, and tested against a stub carrying dates, but until both fixes land it will not fire in the running app — every state ships showing `Stay dates were not provided for this offer.` **Do not ship any "your stay" phrasing that presumes dates**, and do not work around the gap by reading dates from anywhere other than `hotelContext.checkIn/checkOut/nightCount`. The stay-line branch is a `checkIn && checkOut ? … : …` conditional and nothing more.

D1, D2, D3, D5 and the offer-reference relocation have no dependency on this and are fully shippable today.

---

## 8. Instrumentation

Each event needs **three** registrations in `app/api/analytics/route.ts`: `EVENT_PROPERTIES` (`:12-62`), `REQUIRED_PROPERTIES` (`:69-…`), and a branch in `validPropertyValue` (`:148-291`). A missing one silently rejects the event.

| Event | Properties | Validation |
|---|---|---|
| `hotel_return_state_viewed` | `handoffAttemptId`, `awayDurationBucket`, `stubPresent` | `handoffAttemptId` → existing `ID` branch (`:149`); `awayDurationBucket` → existing (`:229`); `stubPresent` → boolean |
| `hotel_return_outcome_declared` | `handoffAttemptId`, `outcome`, `awayDurationBucket` | `outcome` → `oneOf(['booked','not_booked'])` |
| `hotel_stay_stub_written` | `offerId`, `hasStayDates`, `storageAvailable` | `offerId` → existing `OPAQUE_VALUE` (`:165`); both booleans |
| `hotel_repeat_offer_recognized` | `offerId`, `entryPath`, `rebooked` | `entryPath` → `oneOf(['inline','reference_expired'])`; `rebooked` boolean |

`hotel_handoff_returned`, `hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, and `hotel_handoff_return_reason_selected` are unchanged.

`offerId` values that do not match `OPAQUE_VALUE` must be omitted from the event, not truncated and not hashed inline — a hash would need its own validator branch and buys nothing here.

`awayDurationBucket` remains an analytics dimension only. It gates no branch, preselects no answer, and changes no string. Joining `outcome` against it is the only way to learn whether duration could ever become a usable proxy; that question stays open by design.

**Timing:** `hotel_return_state_viewed` fires once when S1 **or** S4 first renders (`stubPresent` distinguishes them). `hotel_repeat_offer_recognized` fires once on S4/S5 mount with the matching `entryPath`; `rebooked` is emitted as `false` on mount and the event is re-emitted with `rebooked: true` if the traveler activates "Book this again" in the same session.

---

## 9. Acceptance criteria (for UI and TEST)

**D1 — placement, announcement, focus**
1. After a continue click, `visibilitychange` hidden → visible renders the return state in the DOM. (Fails today.)
2. The return state's DOM position precedes the handoff `<a href={providerUrl}>`.
3. With `hotelContext.smokingPolicy` set to the unavailable fallback, the return state still renders.
4. On appearance, `document.activeElement` is the return state's H2.
5. At 375px nothing in the return state overflows or overlaps `HotelDecisionSummary`.
6. `hotelSupplement` remains declared on `ReviewShell` and is not removed.

**D2 — ask, never infer**
7. With `awayDurationBucket` forced to each of `<5s`, `5–30s`, `30–120s`, `120s+`, the rendered return state is byte-identical.
8. Every string in the declared branch that references the reservation sits adjacent to "You told us" or "expaify has not confirmed".
9. "I didn't book" restores the CTA to `btn-primary` with label `Check rooms at {partner}`.
10. The mismatch survey needs at least two interactions from the return state.
11. Both choices reach by Tab and activate on Enter and Space.

**D3 — checklist**
12. All four items render with the partner name resolved, or "the booking partner" when `partner.named` is false.
13. No `<input>`, `<select>`, `<textarea>`, or checkbox exists in the checklist.
14. No item claims expaify holds, has received, or can retrieve any value.
15. At 375px the checklist is one column with no horizontal scroll.
16. Screen-reader order is heading → four items → ownership line.

**D4 — durability**
17. Declare "I booked", reload the same `offerId` URL → S4 renders.
18. With `localStorage.setItem` throwing, S2 renders fully, the storage line appears, and no unhandled rejection reaches the console.
19. A stub without `checkIn`/`checkOut` renders "Stay dates were not provided for this offer." and no date placeholder.
20. Writing an 11th stub evicts exactly the oldest by `declaredBookedAt`.
21. `lib/db/schema.sql` is unchanged; no `/api/account` route is added; `HOTEL_CONTEXT_TTL_SECONDS` is still `30 * 60`.
22. No stored field is a float; `priceCents` is an integer and `currency` matches `/^[A-Z]{3}$/`.
23. A corrupt store value renders S0, not an error.

**D5 — repeat visit and recovery**
24. With a stub, re-entering the inline `/book` URL renders S4 and the handoff CTA reads "Book this again".
25. With a stub and an expired `hotelContextRef` (plus `offerId`), `InvalidHotelState` does not render; S5 does.
26. With no stub and an expired `hotelContextRef`, `InvalidHotelState` renders with the added email line and keeps its assertive live region.
27. The re-issued handoff `<a href>` passes `isValidatedAffiliateProviderUrl`; a stub failing it renders S5 without that action.
28. At 375px S4 renders above `HotelDecisionSummary` content without overlap.

**D5b — offer reference**
29. In S2, S4, and S5 the reference renders with no `<details>` ancestor.
30. Its helper text explicitly denies that it is a reservation number, in all four locations including the pre-handoff `<details>`.
31. The value is selectable and wraps at 375px.

**Global**
32. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.
33. No string in any state asserts a reservation status expaify has not observed (§0).
34. No new CSS custom property, colour, or font size is introduced; `--success` is not used by this feature.
35. Every interactive element is ≥44px tall and shows `--focus-ring` on `focus-visible`.

---

## 10. Explicitly out of scope

Carried from research §6; UI must not touch these:

1. `lib/db/schema.sql` merge-conflict markers at `:272`, `:395`, `:408` — **P0, DEV**, separate ticket.
2. `ReviewShell` never rendering `hotelSupplement`, which also drops `TrackedSmokingPolicyPanel surface="review"` — belongs to `hotel-smoking-policy`. Do not delete the prop.
3. Flight `bookingRef` non-durability (`app/api/book/route.ts:211-215`, `BookingFlow.tsx:1356`) — **separate P0**; do not import the flight confirmation pattern here.
4. Wiring `parseStayContinuity` at both call sites and un-hardcoding `HotelDecisionSummary`'s stay panel — `hotel-booking-handoff-trust` (§7).
5. `handoffAttemptId` being per-mount (`:800`), which prevents joining `hotel_handoff_viewed` to `hotel_handoff_returned` across a reload.
6. Any server-side stay record, account trips list, or `/api/account` route.

---

## 11. Handoff

Next ticket: `UI-HOTEL-BOOKING-CONFIRMATION-01` — implement §5 states, `lib/booking/hotelStayStore.ts` (§4), the `offerId` append in `app/api/book/hotel-context/route.ts` and its pass-through in `app/book/page.tsx` (§5.6), and the four analytics registrations (§8). UI layer plus one client-side storage module; no provider calls, no schema change, no business-logic change.
