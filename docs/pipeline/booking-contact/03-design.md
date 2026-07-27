# UXDES-BOOKING-CONTACT-01: Hotel Booking Contact Confidence — Design Spec

**Stage:** UX Design (UXDES)
**Date:** 2026-07-27
**Priority:** P1
**Upstream:** `docs/pipeline/booking-contact/01-discovery.md`, `docs/pipeline/booking-contact/02-research.md`
**Surface:** `HotelHandoffReview` in `app/book/BookingFlow.tsx`, reached from `HotelCard` → `buildHotelBookingHref` → `/book?kind=hotel`

---

## 0. What this spec adds, and what it must not touch

**Adds:** one collapsed-by-default disclosure, **“Who handles my booking?”**, positioned immediately before the outbound hotel CTA in DOM and tab order. When expanded it shows exactly two owner blocks — the booking partner (reservation) and expaify (deal and handoff) — plus privacy-safe analytics.

**Must not touch:** `providerUrl` and its affiliate query, `target="_blank"`, `rel="noopener noreferrer sponsored"`, the CTA label, the CTA accessible name, the new-tab cue, the partner-identity resolution in `getHotelPartnerIdentity`, the price/policy honesty copy, `hotel_handoff_viewed` / `hotel_handoff_back_clicked` / `hotel_handoff_returned` payloads, the money contract, or any provider/API code.

**Must not restate:** who takes payment, final-price volatility, cancellation-policy verification, affiliate disclosure, new-tab behavior. Those already exist and stay where they are.

---

## 1. Two corrections to the research brief, applied in this spec

These are stated up front because both change implementation.

### C1 — The outbound CTA is now the *first* section, not the last

Research directive D1 assumes the CTA sits after the responsibility facts at the bottom of the page. The current build renders `Check rooms with provider` (heading + responsibility paragraph + CTA + new-tab cue) as the **first** section of `HotelHandoffReview` (`app/book/BookingFlow.tsx:1051-1073`), with `Supporting evidence` below it.

**Resolution:** the intent of D1 — *the disclosure is the last thing available before the outbound action* — is preserved by placing the disclosure **inside the `hotel-provider-title` section, after the responsibility paragraph and before the CTA anchor**. Do not move the CTA. Do not place this disclosure in `Supporting evidence`; that would put it after the outbound action in reading order and break the directive.

### C2 — `track()` now has a production sink

Research §"Contact and measurement gap" states `track()` is development-only with no production sink. That is stale: `lib/analytics.ts` now posts to `NEXT_PUBLIC_ANALYTICS_ENDPOINT` and to `/api/analytics` via `sendBeacon` with a `fetch` fallback.

**Resolution:** the events in §7 are live-capable, not schema-only. This raises rather than lowers the privacy bar — the property allowlist in §7.3 is binding, not advisory. Route all emissions through the existing `emitAnalytics` wrapper (`app/book/BookingFlow.tsx:151`) so a throw can never block the toggle or the handoff.

---

## 2. Hierarchy on this surface

Unchanged primary and secondary; this spec inserts one tertiary element.

| Level | Element | Status |
|---|---|---|
| Primary | `Check rooms at {Partner}` CTA | unchanged |
| Primary | Hotel name, observed nightly rate, Deal Score | unchanged |
| Secondary | Provider responsibility paragraph, new-tab cue | unchanged |
| **Tertiary** | **“Who handles my booking?” disclosure trigger (collapsed)** | **new** |
| Tertiary (on demand) | Two owner blocks inside the disclosure | new |
| Supporting | Rate restrictions, parking, readiness, requests, funds policy, offer details | unchanged |

The collapsed trigger must read as a quiet, secondary link-weight control. It must not use `btn-primary`, a badge, a warning tone, an icon, or a colored background. Nothing on this screen may out-weigh the CTA after this change.

---

## 3. Component contract

New file: **`app/components/HotelBookingOwnership.tsx`**
Exported component: **`HotelBookingOwnershipDisclosure`**

Keeping it out of `BookingFlow.tsx` keeps that file's growth bounded and makes the copy directly unit-testable.

```ts
export type HotelBookingOwnershipPartner = {
  /** Display label already resolved by getHotelPartnerIdentity; "booking partner" when unresolved. */
  label: string
  /** True only when the host matched a known partner domain. */
  named: boolean
}

/**
 * Verified, monitored expaify product-support destination.
 * Null until product/operations confirms one — see §8. Never infer, never guess a path.
 */
export type ExpaifyIssueRoute = {
  href: string
  destinationType: 'help_center' | 'mailto'
} | null

export type HotelBookingOwnershipDisclosureProps = {
  partner: HotelBookingOwnershipPartner
  /** Defaults to null. Passing a value is gated on §8 sign-off. */
  expaifyIssueRoute?: ExpaifyIssueRoute
  /** Fires once, on the first closed → open transition. */
  onOpen?: () => void
  /** Fires on activation of an owner-attributed help link. */
  onContactClick?: (owner: 'partner' | 'expaify', destinationType: 'help_center' | 'mailto') => void
}
```

`BookingFlow.tsx` passes the existing `partner` object (`{ label, named }` from `getHotelPartnerIdentity`) straight through. The component receives **no** hotel context, offer id, price, or URL — it cannot leak what it never holds.

### 3.1 Control pattern — button + region, not `<details>`

`<details>` is used elsewhere in this file, but D1 requires explicit `aria-expanded` and `aria-controls`, and requires the owner content to be absent from the accessibility tree while collapsed. Use the same button + conditionally-rendered region pattern already used in `app/deals/HotelRecoveryUI.tsx:166` and `app/components/FlightCard.tsx:552`.

- `<button type="button">` with `aria-expanded={open}` and `aria-controls="hotel-booking-ownership-panel"`.
- Panel `id="hotel-booking-ownership-panel"`, rendered **only when `open === true`** (conditional render, not `hidden`), so collapsed content is not in the DOM or the accessibility tree.
- Native button gives Enter and Space toggling for free. Do not add key handlers.
- Focus stays on the trigger on both open and close. Do not move focus into the panel, do not scroll, do not autofocus.
- The panel is `<section aria-labelledby="hotel-booking-ownership-heading">` containing a visually hidden `<h3 id="hotel-booking-ownership-heading">Who handles my booking</h3>`, then the two owner blocks as `<h4>` + prose. Heading levels: the page section is `<h2 id="hotel-provider-title">`, so `<h3>` for the panel and `<h4>` for each owner block.

---

## 4. Final copy — every visible string

No placeholder copy. All strings below ship verbatim.

### 4.1 Trigger (both states)

| Element | Copy |
|---|---|
| Trigger label | `Who handles my booking?` |
| Accessible name | Same as visible label — no `aria-label` override |

The trigger label does not vary with partner state. Chevron optional; if used it must be `aria-hidden="true"` and rotate on open.

### 4.2 Owner block 1 — the booking partner (always first in DOM)

**Named partner** (e.g. `partner.named === true`, `partner.label === 'Booking.com'`):

> **Booking.com manages your reservation**
>
> After checkout, Booking.com provides your confirmation and is your first contact for reservation status, changes, cancellations, refunds, payment questions, or a missing confirmation. Use the contact details in your confirmation or on the site where you complete the booking.

**Unresolved partner** (`partner.named === false`):

> **Your booking partner manages your reservation**
>
> After checkout, your booking partner provides your confirmation and is your first contact for reservation status, changes, cancellations, refunds, payment questions, or a missing confirmation. Use the contact details in your confirmation or on the site where you complete the booking.
>
> Not sure which company that is? Check the confirmation you receive, your card statement, or your browser history after checkout.

The identification sentence renders **only** in the unresolved variant — when the partner is named, it is noise.

Binding wording rules:

- Use **“provides your confirmation.”** Never “emails,” “sends by email,” or any named channel. Provider data does not establish the channel.
- Never name the property as a third owner in this disclosure.
- Never render a phone number, email address, or partner support link from inferred data.
- Never turn `providerUrl` into a "support" or "contact" link. It is an affiliate checkout deeplink.

### 4.3 Owner block 2 — expaify (always second in DOM)

**Heading (both states):**

> **expaify helps with the deal and handoff**

**State B1 — no verified expaify support destination (ships today, `expaifyIssueRoute === null`):**

> expaify can help only with what it shows here: the hotel, the price, or the booking link on this page. expaify cannot access, change, cancel, or refund a reservation completed with the booking partner.
>
> If something on this page looks wrong, note the offer reference under “Show offer details” before you continue.

No link, no disabled control, no empty affordance, no guessed `/help` path. B1 is a truthful statement of scope, not a dead end dressed as an action.

**State B2 — verified destination supplied (`expaifyIssueRoute !== null`, gated on §8):**

> Contact expaify if the hotel, price, or booking link shown here looks wrong. expaify cannot access, change, cancel, or refund a reservation completed with the booking partner.

Then one link:

| Element | Value |
|---|---|
| Visible label | `Report an expaify issue` |
| Accessible name | `Report an expaify issue with this deal or link` |
| `href` | `expaifyIssueRoute.href` exactly as supplied — no interpolation |
| `target` | none — same tab; this is not an outbound partner link |
| `rel` | `noopener` if the verified route is external `http(s)`; omit for `mailto:` |

For a `mailto:` route, the only permitted parameter is a fixed subject: `?subject=expaify%20deal%20or%20link%20issue`. No offer id, hotel name, price, provider URL, affiliate query, traveler data, or free text may appear in the href — that constraint is what makes the link safe to instrument.

Never reuse the Terms or Privacy contact label as booking support. `questions@expaify.com` is currently labeled for terms and privacy questions only (`app/terms/page.tsx:46`, `app/privacy/page.tsx:39`, `:55`) and is **not** approved for this surface by default.

### 4.4 Copy prohibitions (assert as negative tests)

The disclosure must never contain: `email you`, `we will contact`, `contact us` without a destination, `support ticket`, `refund your`, `cancel your booking for you`, `manage your booking here`, `call`, `phone`, or any string implying expaify holds a reservation record.

---

## 5. States

| # | State | Trigger | Rendering |
|---|---|---|---|
| S1 | Collapsed (default) | Every hotel review load | Trigger only. `aria-expanded="false"`. Panel not in DOM. Emits nothing. |
| S2 | Expanded, named partner | User activates trigger, `partner.named === true` | Trigger `aria-expanded="true"` + panel with §4.2 named copy and §4.3 |
| S3 | Expanded, unresolved partner | Same, `partner.named === false` | §4.2 unresolved copy incl. identification sentence, + §4.3 |
| S4 | expaify route unconfirmed | `expaifyIssueRoute == null` (default today) | Block 2 renders B1, no link |
| S5 | expaify route verified | `expaifyIssueRoute != null` | Block 2 renders B2 + one link |
| S6 | Re-collapsed | Second activation | Panel removed from DOM, focus stays on trigger, no second `hotel_booking_help_opened` |
| S7 | Reopened in same session | Third activation | Panel returns; `onOpen` does **not** fire again (once per mount) |
| S8 | Analytics failure | `track()` throws or network fails | Toggle, link navigation, and CTA all still work — `emitAnalytics` swallows it |
| S9 | Return-from-partner | `showReturnPrompt` becomes true | Disclosure state is unchanged and independent of the return prompt |

**Loading:** none. The disclosure renders from already-resolved props; it must never fetch, never show a spinner, never gate on `fundsPolicyLoadState` or the document-readiness check.

**Empty:** none. There is no data-empty state — the two owner blocks are always available. `partner.named === false` is S3, not an empty state.

**Error:** none. No network dependency means no error state. If `partner.label` is missing or blank, fall back to the S3 unresolved copy; never render `undefined`, an empty heading, or a bare period.

### 5.1 Edge cases

- **Very long partner label** (e.g. a long unknown host): the label wraps. Apply the existing `partnerLabelWrapCls` (`min-w-0 [overflow-wrap:anywhere]`) to any element interpolating `partner.label`. No truncation, no ellipsis — a half-shown owner name is worse than a wrapped one.
- **Opaque redirect host** (`tp.media`, `localhost`): already returns `named: false` upstream → S3. Never surface the raw host in visible copy.
- **Partner label containing markup-like characters**: React escapes by default; do not use `dangerouslySetInnerHTML`.
- **Rapid double-activation**: the once-per-mount `onOpen` guard is a ref, not state, so a fast double click cannot emit twice.
- **`prefers-reduced-motion: reduce`**: disable the chevron rotation transition and any height animation; the panel appears immediately.
- **JS disabled / SSR**: the trigger renders collapsed and inert. Acceptable — no primary task is lost, and the CTA is unaffected. Do not attempt a `<noscript>` fallback.

---

## 6. Layout, Tailwind classes, and responsive behavior

All classes use existing tokens from `app/globals.css`. No new colors, no new font sizes.

### 6.1 Placement

Inside `<section aria-labelledby="hotel-provider-title">`, between the responsibility `<p>` and the `<div className="mt-5 flex flex-col gap-3">` that wraps the CTA:

```
h2  Check rooms with provider
p   The provider confirms room details, live availability, …
─── HotelBookingOwnershipDisclosure  ◀── inserted here
div CTA anchor + new-tab cue
```

Tab order after the change: … → disclosure trigger → [expanded links, if any] → outbound CTA. The CTA remains the next focusable primary action after the disclosure content.

### 6.2 Classes

```tsx
// wrapper
"mt-4 border-t border-[color:var(--border)] pt-3"

// trigger
"inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg py-2 text-left " +
"text-sm font-medium leading-6 text-[color:var(--brand)] " +
"hover:text-[color:var(--brand-hover)] " +
"focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"

// chevron (aria-hidden)
"h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none " + (open ? "rotate-180" : "")

// panel
"mt-2 grid gap-3 sm:grid-cols-2"

// owner block
"rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4"

// owner heading (h4)
"text-sm font-bold leading-5 text-[color:var(--text-1)] " + partnerLabelWrapCls

// owner body
"mt-2 text-sm leading-6 text-[color:var(--text-2)] " + partnerLabelWrapCls

// secondary body line (identification sentence / offer-reference pointer)
"mt-2 text-sm leading-6 text-[color:var(--text-3)]"

// expaify issue link (S5 only)
"mt-3 inline-flex min-h-11 items-center rounded-lg border border-[color:var(--border)] px-4 " +
"text-sm font-medium text-[color:var(--text-1)] " +
"hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] " +
"focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
```

The link classes deliberately match the existing `Report a mismatch` control so the two expaify-owned report affordances read as one family.

### 6.3 Mobile — 375px

- `grid gap-3` with no column count → owner blocks stack, partner first.
- Trigger is full width, `min-h-11` (44px) touch target, label left, chevron right, no wrapping collision at 375px because the label is short and the chevron is `shrink-0`.
- Expanded panel adds roughly two stacked blocks above the CTA. The CTA must remain reachable by a single scroll from the trigger. If verification at 375px shows the expanded panel pushing the CTA more than ~1.5 viewport heights below the trigger, tighten to `px-3.5 py-3` on both blocks (already the mobile default) — do not shorten the ownership copy, and do not collapse the two owners into one block.
- No horizontal overflow: long partner labels wrap via `[overflow-wrap:anywhere]`.

### 6.4 Desktop — 1280px

- `sm:grid-cols-2` → the two owner blocks sit side by side, partner left / first in DOM.
- Blocks are equal height via grid; do not use fixed heights.
- The panel never exceeds the width of the provider section.

### 6.5 Focus and keyboard

- Trigger: visible `--focus-ring` box shadow, `focus-visible` only.
- `Tab` reaches the trigger before the CTA in both states.
- `Enter` and `Space` toggle (native button behavior).
- `Escape` does **not** close it — this is a disclosure, not a dialog or a menu.
- Screen reader: activating the trigger announces the expanded state via `aria-expanded`; the panel's `aria-labelledby` heading gives it a name. Each owner block is a labeled `<h4>` heading so a heading-navigation user can jump between owners.
- The S5 link's accessible name is owner-specific (`Report an expaify issue with this deal or link`) so a links-list user can tell it apart from the outbound CTA.
- Color is never the only signal: owner separation is carried by heading text and block borders, not tone.

---

## 7. Analytics

Route everything through `emitAnalytics` in `BookingFlow.tsx`. Preserve all existing event names and payloads.

### 7.1 New events

| Event | Fires when | Properties |
|---|---|---|
| `hotel_booking_help_opened` | first closed → open transition per mount | `source`, `partnerHost`, `partnerNamed`, `locationPrecision` |
| `hotel_booking_help_contact_clicked` | an owner-attributed help link is activated (S5 only today) | above + `owner: 'partner' \| 'expaify'`, `destinationType: 'help_center' \| 'mailto'` |

`source`, `partnerHost`, and `locationPrecision` are already computed in `analyticsProps` (`app/book/BookingFlow.tsx:713-722`). Reuse those exact values; do not recompute.

Name check: this is distinct from the existing `hotel_request_help_opened` (special-requests disclosure). Do not merge, rename, or reuse that event.

### 7.2 Modified event

`hotel_handoff_continue_clicked` gains **one** property: `helpViewed: boolean` — true when the ownership disclosure was opened at least once before the CTA activation. Every existing property stays. Implement with a `helpViewedRef` in `HotelHandoffReview` set by `onOpen`; do not use state, so the CTA handler never races a re-render.

### 7.3 Prohibitions (binding — `track()` reaches production)

Never include in either new event: hotel or guest names, email or phone, offer IDs, confirmation numbers, full or partial provider URLs, referrer, URL query strings, free text, or raw dwell time. Never emit `hotel_booking_help_contact_clicked` for plain instructional copy, for the B1 offer-reference sentence, or for the outbound checkout CTA.

### 7.4 Derived measures

- Help intent = unique `hotel_booking_help_opened` ÷ `hotel_handoff_viewed`
- Contact engagement by owner = unique `hotel_booking_help_contact_clicked` grouped by `owner` ÷ help opens — reported separately per owner, never summed into one "support" metric
- Help-to-handoff continuation = `hotel_handoff_continue_clicked` with `helpViewed=true` ÷ help opens
- Unresolved diagnostic sessions = help opens with no contact click and no continue/back event — a diagnostic signal, not proof of abandonment

---

## 8. Dependency — expaify product-support destination

**Status: unresolved. This spec ships without it.**

The repository still has no verified, monitored expaify product-support destination. `questions@expaify.com` appears only on Terms and Privacy, labeled for terms and privacy questions. There is also an existing dangling reference — “Use this reference if you contact expaify support” under *Show offer details* (`app/book/BookingFlow.tsx:1176`) — which names a support path the product does not expose. Fixing that line is **out of scope for this ticket**; it is logged in §11.

**Decision:** UI implements **S4 / B1** — instruction-only, no link, `expaifyIssueRoute` defaulting to `null`. Ship it. The design is complete and truthful without the link; the link is an enhancement, not a prerequisite.

**Unblocking checklist** for whoever confirms the route:

1. The destination is monitored by a human or a ticketing queue for **product** issues, not only legal or privacy requests.
2. Its public label covers hotel deal and link problems.
3. It is either a real help-center URL or a mailbox explicitly approved for product support.
4. It never receives offer IDs, hotel names, prices, provider URLs, or traveler data via its href.

When all four are met, pass `expaifyIssueRoute` and state S5 activates with no other change. If the answer is `questions@expaify.com`, the Terms and Privacy labeling must be widened first — otherwise the link contradicts the pages that define it.

---

## 9. Acceptance criteria for UI implementation

1. Disclosure renders collapsed on every hotel review load; panel content is absent from the DOM until opened.
2. Trigger is the last focusable element before the outbound CTA, in both DOM and tab order.
3. `aria-expanded` and `aria-controls` are present and correct in both states; Enter and Space toggle; focus remains on the trigger.
4. Named-partner variant interpolates only `partner.label`; unresolved variant uses “your booking partner” and includes the identification sentence.
5. All seven needs — confirmation, reservation status, changes, cancellations, refunds, payment questions, missing confirmation — are assigned to the transaction owner in both variants.
6. Neither variant promises email, names a channel, or renders a partner contact link.
7. The expaify block states the inability to access, change, cancel, or refund; with `expaifyIssueRoute === null` it renders no link and no disabled control.
8. `providerUrl`, CTA label, CTA accessible name, `target`, `rel`, and every existing handoff event payload are byte-identical to before, in both collapsed and expanded states.
9. Two stacked owner blocks at 375px with no horizontal overflow and no overlapping text; side-by-side at 1280px with partner first.
10. `hotel_booking_help_opened` fires once per mount on first open; `helpViewed` is added to `hotel_handoff_continue_clicked`; no new event carries a prohibited property.
11. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.

---

## 10. Test plan for UI/TEST stages

Extend `app/book/__tests__/BookingFlow.test.tsx` (both `hotelContext` fixtures already exist there).

**Positive:**
- Unresolved fixture (`tp.media`): text contains `Who handles my booking?`, `Your booking partner manages your reservation`, `provides your confirmation`, `missing confirmation`, `Not sure which company that is`, `expaify helps with the deal and handoff`, `cannot access, change, cancel, or refund`.
- Named fixture (`booking.com`): contains `Booking.com manages your reservation`; does **not** contain `Not sure which company that is`.
- Trigger has `aria-expanded="false"` and `aria-controls="hotel-booking-ownership-panel"` on first render.
- After activation: `aria-expanded="true"`, panel present, both `<h4>` owner headings present, activeElement is still the trigger.

**Negative:**
- Collapsed render contains none of the owner-block strings.
- Neither variant contains `email your confirmation`, `we will contact`, `phone`, or a `mailto:` href while `expaifyIssueRoute` is null.
- Rendered anchor count inside the panel is 0 in S4.
- The outbound anchor's `href`, `target`, `rel`, and `aria-label` are unchanged from the pre-change snapshot, in both collapsed and expanded states.
- `hotel_booking_help_contact_clicked` is not emitted on CTA activation.

**Analytics:** with `track` mocked, assert one `hotel_booking_help_opened` after two open/close/open cycles, and that `hotel_handoff_continue_clicked` carries `helpViewed: true` after an open and `false` without one. With `track` mocked to throw, assert the toggle and the CTA still function.

**Manual (TEST stage):** 375px and 1280px screenshots collapsed and expanded; keyboard-only pass from page load to CTA; screen-reader pass confirming expanded-state announcement and owner-specific headings.

---

## 11. Out of scope / logged for follow-up

1. **Dangling expaify support reference:** “Use this reference if you contact expaify support” (`app/book/BookingFlow.tsx:1176`) names a route the product does not expose. Should be corrected or removed once §8 resolves. Not this ticket.
2. **Partner support deeplink:** `BookingHotelContext` carries no verified support URL. Adding one requires a provider data contract; it must never be inferred from the affiliate checkout URL.
3. **Comprehension gate (research D4):** the 5-participant first-click study assigning missing confirmation, cancellation/refund, unexpected charge, and wrong-hotel/broken-link to the correct owner is a research activity, not an implementation blocker. Run it against the shipped S4 build, including the unresolved-partner variant.
4. **Post-booking surfaces:** confirmation lookup, reservation status, case management, and in-expaify hotel booking remain excluded.

---

## 12. Handoff

Ready for **UI-BOOKING-CONTACT-01**. UI implements §3–§7 with `expaifyIssueRoute` defaulting to `null` (state S4/B1), changes no API route, provider, or business logic, and hands off to `TEST-BOOKING-CONTACT-01`.
