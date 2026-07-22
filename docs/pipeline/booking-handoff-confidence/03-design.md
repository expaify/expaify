# UX Design Spec — Booking Handoff Confidence

**Ticket:** UXDES-BOOKING-HANDOFF-CONFIDENCE-01  
**Stage:** UXDES  
**Date:** 2026-07-22  
**Surface:** `HotelHandoffReview` in `app/book/BookingFlow.tsx`, reached from the `HotelCard` “Review hotel” CTA  
**Upstream:** `docs/pipeline/booking-handoff-confidence/02-research.md` at Git commit `9de2ba1` (directives D1–D5 and metrics §6). The file is committed on `main` but absent from this assigned branch; this spec used the exact committed artifact read-only.  
**Scope:** UI hierarchy, copy, host-derived partner identity, interaction states, and analytics emits on the existing hotel handoff. Flight booking, provider integrations, deeplink construction, and hotel-result-card copy are unchanged.

## 1. Outcome and non-negotiable invariants

A first-time traveler must be able to answer, from visible content before activating the outbound link:

1. Who will take over the booking?
2. What does the selected nightly rate mean, and can it change?
3. What happens to the expaify page when the partner opens?

The implementation must preserve `hotelContext.providerUrl` byte-for-byte as the anchor `href`, `target="_blank"`, `rel="noopener noreferrer sponsored"`, and every affiliate marker. Parsing the URL is read-only and is used only to derive a display label and a hostname-only analytics value. Do not rebuild, normalize, decode, append to, or reserialize the outbound URL.

Money remains `priceCents: number` plus `currency: string`. No vendor call, loading request, date calculation, total-stay calculation, or freshness timestamp is introduced.

## 2. Information hierarchy

### Primary — destination and action

- Visible “You’ll book with {partner}” statement.
- Primary “Continue to {partner}” anchor with a visible external-link icon.
- Visible “new tab / search stays open” cue immediately below it.

### Secondary — rate expectation

- Existing selected nightly rate and basis.
- One honest sentence explaining that it is the rate expaify last saw, that the partner confirms the live rate, and that the partner total may differ.
- Explicit absence of freshness data.

### Tertiary — verification context

- One “expaify shows / {partner} confirms” responsibility split.
- Existing hotel facts, rate source, offer reference, and location precision/warning.
- “Back to search” actions.

Remove the amber `Provider confirmation required` status panel, the standalone “Before you continue” panel, the repeated visible `hotelTermsCopy`, and the generic “Continue to provider” label from the valid hotel handoff only. They repeat deferral language without resolving identity. Do not alter recovery states or the flight path.

## 3. Partner identity derivation (D1)

Create a small pure display helper local to the booking surface (or an existing neutral display-helper module if UI finds one suitable):

```ts
type HotelPartnerIdentity = {
  host: string
  label: string
  named: boolean
}
```

Given the already validated `providerUrl`:

1. Call `new URL(providerUrl)` without modifying the input.
2. Read `hostname` only; lowercase it, remove one trailing dot, and strip a leading `www.` for matching.
3. Match known destination domains on a label boundary, including subdomains. Minimum mappings:
   - `booking.com` → `Booking.com`
   - `hotels.com` → `Hotels.com`
   - `expedia.com` → `Expedia`
   - `agoda.com` → `Agoda`
   - `priceline.com` → `Priceline`
4. Treat redirect/affiliate infrastructure such as `tp.media`, IP literals, localhost, a missing hostname, a parse failure, or a derived domain label longer than 40 characters as unresolved. A redirect host is not the company taking payment.
5. For a non-opaque host not in the map, display a conservative registrable-domain-style label: remove common routing subdomains (`www`, `m`, `go`, `redirect`, `click`), title-case the brand label, and retain the public suffix in lowercase (for example, `checkout.examplehotel.com` → `Examplehotel.com`). If a credible brand label cannot be derived, use the unresolved state.
6. Never show or emit the URL scheme, username, password, port, path, query, fragment, affiliate ID, or full `providerUrl`.

Resolved example:

```ts
{ host: 'www.booking.com', label: 'Booking.com', named: true }
```

Unresolved example for the existing `https://tp.media/r?...` test fixture:

```ts
{ host: 'tp.media', label: 'booking partner', named: false }
```

`host` is the normalized hostname only and may be used in approved analytics props. `label` is presentation copy. `named` determines fallback grammar and `partnerNamed`.

The existing summary fact labeled `Provider` becomes **Rate source** and continues to display the source-derived label. Destination identity must never be inferred from `hotelContext.provider`, because the source and booking destination can differ.

## 4. Component composition and final copy

### 4.1 Page introduction

Keep `ReviewShell` and its current responsive layout.

| Element | Final copy |
|---|---|
| Eyebrow | `Hotel handoff` |
| H1 | `Review selected hotel` |
| Intro | `Review the hotel and nightly rate expaify found. The booking partner confirms the live rate and final details before you pay.` |
| Top navigation | `← Back to search` |

Do not render a status panel on the valid hotel handoff. The intro is neutral explanatory text, not an alert or live region.

### 4.2 `HotelSummary`

Preserve the existing hotel name, location display, selected nightly rate, basis, currency, and offer reference. Make these changes:

- Fact label `Provider` → `Rate source`.
- Add the rate-expectation block immediately after the selected-rate header region and before the fact grid, spanning the available summary width.

Rate-expectation block, all visible:

| Element | Resolved partner | Unresolved partner |
|---|---|---|
| Label | `Rate expectation` | `Rate expectation` |
| Main sentence | `This is the nightly rate expaify last saw from {Rate source}. {Partner} confirms the live rate, taxes, and fees before you pay—the total you see there may differ.` | `This is the nightly rate expaify last saw from {Rate source}. The booking partner confirms the live rate, taxes, and fees before you pay—the total you see there may differ.` |
| Freshness sentence | `Rate freshness not available from this provider.` | `Rate freshness not available from this provider.` |

`{Rate source}` uses the existing human-readable source mapping (`providerDisplayName` or equivalent), not the destination host. `{Partner}` uses the derived partner label. This block appears exactly once. Do not use “guaranteed,” “locked,” “held,” “reserved,” or language implying the rate will remain available.

Recommended Tailwind/token pattern:

```txt
mt-5 rounded-lg border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-4 py-3 sm:px-5 sm:py-4

label: text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]
main: mt-2 text-sm leading-6 text-[color:var(--text-2)]
freshness: mt-2 text-xs font-medium leading-5 text-[color:var(--text-3)]
```

Do not render a clock icon, timestamp-shaped placeholder, skeleton, or total-stay amount.

### 4.3 Sticky handoff panel

Keep the existing panel container in the right column. Remove the current “Before you continue” text and repeated terms paragraph. Render in this order:

1. Partner identity.
2. Responsibility split.
3. Primary outbound anchor.
4. New-tab/search-preserved cue.
5. Secondary “Back to search” anchor.

Partner identity copy:

| Element | Resolved partner | Unresolved partner |
|---|---|---|
| Eyebrow | `Booking partner` | `Booking partner` |
| Heading | `You’ll book with {Partner}.` | `You’ll book with an external booking partner.` |
| Supporting line | `expaify hands you off; {Partner} takes payment.` | `expaify hands you off; the booking partner takes payment.` |

Responsibility split copy:

| Column | Label | Body |
|---|---|---|
| expaify | `expaify shows` | `Hotel name, location, nightly rate basis, and rate source.` |
| partner, resolved | `{Partner} confirms` | `Final total, taxes, fees, room availability, and cancellation policy.` |
| partner, unresolved | `Booking partner confirms` | `Final total, taxes, fees, room availability, and cancellation policy.` |

This is the sole visible replacement for the repeated `hotelTermsCopy`. “Terms” need not appear as a catch-all because the actionable cancellation-policy and total responsibilities are named explicitly. Do not duplicate either body elsewhere.

Primary anchor copy and cue:

| Element | Resolved partner | Unresolved partner |
|---|---|---|
| CTA | `Continue to {Partner}` | `Continue to booking partner` |
| Visible cue | `Opens {Partner} in a new tab. Your expaify search stays open here.` | `Opens the booking partner’s site in a new tab. Your expaify search stays open here.` |
| Secondary anchor | `Back to search` | `Back to search` |

The CTA contains the text followed by a visible external-link SVG. Use a standard northeast-arrow glyph rather than the current right arrow. The SVG is `aria-hidden="true"`, `focusable="false"`, `shrink-0`, 16×16, and uses `currentColor`. The cue is ordinary visible text and creates no tab stop.

CTA accessible name:

- Resolved: `Continue to {Partner} for {Hotel name}. Opens {Partner} in a new tab. The selected nightly rate is {formatted rate}, {price basis}. The final total may differ.`
- Unresolved: `Continue to booking partner for {Hotel name}. Opens the booking partner’s site in a new tab. The selected nightly rate is {formatted rate}, {price basis}. The final total may differ.`

Do not include the full responsibility list in the `aria-label`; it is already readable as adjacent content. Do not include `providerUrl` or an affiliate marker in any accessible string.

Recommended Tailwind/token pattern:

```txt
panel: rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)]
       p-4 shadow-[var(--shadow-card)] sm:p-6

identity eyebrow: text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]
identity heading: mt-2 break-words text-xl font-bold leading-tight text-[color:var(--text-1)]
identity support: mt-2 text-sm leading-6 text-[color:var(--text-2)]

responsibilities: mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-2
responsibility cell: min-w-0 rounded-lg border border-[color:var(--border)]
                     bg-[color:var(--bg-raised)] px-3.5 py-3
responsibility label: text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]
responsibility body: mt-2 text-sm leading-5 text-[color:var(--text-2)]

actions: mt-5 flex flex-col gap-3
primary: btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2
         rounded-lg px-4 text-center text-sm font-medium
cue: text-center text-xs leading-5 text-[color:var(--text-3)]
secondary: preserve secondaryButtonCls
```

The responsibility cells may stack below 640px. At the 380px desktop sidebar they remain two columns; `min-w-0`, natural wrapping, and no truncation are required.

## 5. State specification

### 5.1 Default — partner resolved

- Render all content in §4 with the resolved partner label in the identity, rate expectation, responsibility label, CTA, cue, and accessible name.
- The outbound link remains immediately usable; there is no confirm checkbox or modal.
- The selected rate remains visually prominent but subordinate to the decision-level partner/CTA in the sticky panel.

### 5.2 Unresolved partner host

- Use every unresolved string in §4; do not display a raw redirect hostname (for example, `tp.media`) as the booking company.
- Preserve the outbound link exactly and keep it enabled because `BookingHotelContext` already validated the URL.
- Do not add a warning color or alarm language. This is a lower-specificity identity state, not an error.
- Analytics sends hostname only and `partnerNamed: false`.

### 5.3 Warning location (`search_area` or `missing`)

- Preserve `getHotelLocationDisplay` as the source of label, value, note, precision, and `isWarning`.
- Preserve the current warning-note styling: `font-medium text-[color:var(--warning)]`.
- Do not promote location uncertainty above partner identity, disable the outbound action, or imply that expaify verified an address.
- Exact existing warning copy remains:
  - Search area: `Only the searched destination is available. Confirm location with the provider.`
  - Missing: `No provider location details were returned.`
- The responsibility split still says the partner confirms room availability; the traveler can use “Back to search” if the location is insufficient.

### 5.4 Loading

Not applicable to a valid `HotelHandoffReview`. All required display data is in `BookingHotelContext`, host parsing is synchronous, and `track` is fire-and-forget. Do not add a spinner, skeleton, disabled CTA, `aria-busy`, or transitional copy. If a future feature adds a provider fetch, it requires a separate design and must not silently reuse this state.

### 5.5 Empty / malformed selection

The valid handoff must never render with absent context. Continue routing malformed or missing hotel query context to the existing `InvalidHotelState`; do not partially render the partner panel or fabricate a partner/rate. Preserve its current copy, focus-on-heading behavior, and sole “Back to search” recovery action. Analytics handoff events do not fire in `InvalidHotelState`.

### 5.6 Error

There is no provider request on this screen and therefore no inline provider-error state. A host that cannot be named uses §5.2, not an error. A malformed URL fails context validation and uses §5.5. Do not catch a parse error and expose technical copy; return the unresolved identity.

### 5.7 Long content and data edge cases

- Hotel name, partner label, source label, location, and offer reference wrap; no decision-critical text is truncated.
- Currency formatting continues through `formatMoney`; do not calculate with or display a float.
- A non-USD rate retains its currency prefix exactly as today.
- No stay dates/nights exist: show no night count, multiplication, subtotal, or total-stay currency figure.
- No freshness timestamp exists: show exactly the freshness-unavailable sentence and no “last checked” date/time.
- If rate source is absent or cannot be humanized, use the existing `Provider unavailable` fallback in the rate-source fact and main sentence; do not substitute the destination partner.

## 6. Responsive behavior

### 6.1 Mobile — 375px viewport

- Preserve shell padding `px-4 py-5`; all content fits within 343px without horizontal scrolling.
- Natural order: top back link → intro → hotel summary/rate expectation → handoff panel.
- Selected nightly rate remains stacked below hotel identity as in the current `flex-col` summary header.
- Responsibility cells stack in one column (`grid`, `sm:grid-cols-2`).
- Primary and secondary actions are full width, at least 44px high. CTA text and partner name wrap to two lines if necessary; the icon remains visible and must not overlap text.
- The new-tab cue remains visible immediately below the CTA. It is not moved into a tooltip, `aria-label`, or hidden breakpoint.
- No sticky behavior on mobile. The page scrolls normally.

### 6.2 Desktop — 1280px viewport

- Preserve `max-w-6xl` and the current `lg:grid-cols-[minmax(0,1fr)_380px]` split.
- Left column: intro and hotel summary. Right column: handoff panel, sticky at `lg:top-6`.
- Responsibility split uses two equal columns within the 380px panel. Allow text to wrap; do not reduce below `text-sm` body copy.
- The full partner identity, CTA, cue, and “Back to search” action are visible without horizontal overflow.

## 7. Keyboard, focus, and interaction rules

Tab order follows DOM order:

1. Top “Back to search”.
2. “Continue to {partner}”.
3. Panel “Back to search”.

There are no tab stops for the external-link icon, visible cue, rate expectation, or responsibility split.

- `Enter` on either anchor performs its native navigation. Space does not gain custom button behavior.
- Do not call `preventDefault`, delay navigation, replace the anchor with a button, or open a tab from JavaScript.
- Keep the global `:focus-visible` outline and `--focus-ring`; the primary and secondary actions must show a visible ring with at least 3px outline/offset plus existing shadow. Do not suppress outline.
- Hover may use existing `.btn-primary` behavior and `secondaryButtonCls`; no hover-only information is introduced.
- After a partner tab is opened and the user returns, do not steal focus or announce a status. Browser focus restoration remains native.
- Both back links emit the same analytics event under §8, subject to the guard there.

## 8. Analytics contract

Use existing `track` from `lib/analytics.ts` and `TrackOnMount`. No new analytics package or production sink is part of this ticket.

Build one stable/memoized props object for the view so `TrackOnMount` does not fire again because an inline object receives a new identity on rerender.

Allowed base props only:

```ts
{
  source: string,             // hotelContext.provider; no hotel name
  partnerHost: string,        // normalized hostname only; no path/query
  currency: string,
  priceCents: number,
  priceBasis: string,
  locationPrecision: string
}
```

Never send `offerId`, hotel name, area/address/coordinates, `providerUrl`, URL path/query, affiliate IDs, or any PII.

| Event | Exact trigger | Additional props / guard |
|---|---|---|
| `hotel_handoff_viewed` | Once when valid `HotelHandoffReview` mounts, through `TrackOnMount` | Base props only. Never fires for `InvalidHotelState`. |
| `hotel_handoff_continue_clicked` | Anchor `onClick`, synchronously before native navigation | Base props + `partnerNamed: boolean`. Set `didContinueRef.current = true`; do not prevent navigation. |
| `hotel_handoff_back_clicked` | Either handoff-page “Back to search” anchor is activated | Emit only when `didContinueRef.current` is false. Props: `source`, `partnerHost`. Do not emit from unrelated flight/recovery screens. |
| `hotel_handoff_returned` | The current document becomes visible after it was hidden following a continue click | Props: `source`, `partnerHost`, `awayDurationBucket`. Emit at most once per continue activation; reset the guard after emit. |

Return-event rules:

1. Add and clean up a client-side `visibilitychange` listener in `HotelHandoffReview`.
2. A continue click arms the listener and records a monotonic start time locally; it does not emit a return by itself.
3. Require a post-click hidden transition before a subsequent visible transition. A click that never hides the page must not produce a false return.
4. Bucket the elapsed away duration, never send raw milliseconds: `<5s`, `5–30s`, `30–120s`, `120s+`.
5. A second continue click may arm one new return event after the previous cycle completes. Do not accumulate listeners.

These events are non-blocking. Analytics failure must never disable or alter the outbound handoff.

## 9. Implementation boundaries

Expected UI-stage files:

- `app/book/BookingFlow.tsx` — partner derivation/display, composition, copy, icon, states, analytics handlers/listener.
- `app/book/__tests__/BookingFlow.test.tsx` — update visible-copy assertions and add resolved/unresolved host, warning-location, invariant, analytics, and accessible-name coverage.

Use existing design tokens in `app/globals.css`; do not add colors or typography tokens. `lib/booking/config.ts`, `providerUrl`, deeplink builders, provider adapters, API routes, and affiliate handling are out of scope and must remain unchanged.

## 10. Acceptance criteria for UI and QA

1. `https://www.booking.com/hotel/x?aid=123` visibly produces “You’ll book with Booking.com.” and “Continue to Booking.com”; the outbound `href`, query, `target`, and `rel` are unchanged.
2. `https://tp.media/r?marker=hotel-marker` visibly uses the booking-partner fallback; it never calls `tp.media` the payment-taking partner.
3. The source fact is labeled “Rate source”; source and destination remain distinct.
4. Exactly one visible rate-expectation block says the displayed nightly rate may differ and that freshness is unavailable. No guaranteed/locked/held claim exists.
5. Exactly one visible “expaify shows / partner confirms” split exists; the old terms sentence and “Before you continue” block are absent.
6. A visible external-link icon and visible new-tab/search-stays-open cue are present in resolved and unresolved states.
7. `search_area` and `missing` location warnings retain exact copy and warning-token styling without disabling the handoff.
8. At 375px there is no overlap, truncation of decision-critical content, or horizontal scroll; both actions are full width and at least 44px high.
9. At 1280px the 380px handoff panel is sticky and usable; responsibility copy wraps without clipping.
10. Keyboard order, native anchor behavior, visible focus rings, and accessible names match §7.
11. All four analytics events follow §8, fire only under their guards, and contain no PII, full URL, offer ID, location detail, or affiliate marker.
12. No loading UI, total-stay cost, last-checked time, provider request, modal, checkbox, or new confirmation step is introduced.

## 11. Handoff and out-of-scope findings

This is a UI-only change: the existing analytics primitive and hotel context provide everything required. Handoff to `UI-BOOKING-HANDOFF-CONFIDENCE-01`.

Out of scope:

- Real hotel rate freshness requires a timestamp to be added to the hotel data/context contract in a later DEV ticket.
- A total-stay cost requires stay dates and night count in the data contract in a later DEV ticket.
- `track()` has no production sink; production analytics transport is a separate platform decision.
- The upstream research commit exists on `main` but is missing from this assigned worktree branch. This spec cites and uses the exact artifact at `9de2ba1`; branch synchronization belongs to the monitor.
