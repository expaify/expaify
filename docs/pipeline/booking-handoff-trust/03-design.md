# UXDES-BOOKING-HANDOFF-TRUST-01: Booking Handoff Trust Design Spec

## Source Inputs

- Discovery: `docs/pipeline/booking-handoff-trust/01-discovery.md`
- Research: `docs/pipeline/booking-handoff-trust/02-research.md`
- Current flight result card: `app/components/FlightCard.tsx`
- Current hotel result card: `app/components/HotelCard.tsx`
- Current review flow: `app/book/BookingFlow.tsx`
- Booking context helpers: `lib/booking/config.ts`
- Design tokens: `app/globals.css`

## Design Decision

Use one result-card CTA contract across flights and hotels: every enabled CTA must show the action, the next surface, the current price basis, and the provider-controlled values before the user clicks.

External flight provider links remain an intentional interim state for this UI ticket. They may continue to open the provider site directly in a new tab because routing them through `/book` requires a DEV-stage extension to `BookingFareContext` for a validated provider URL and affiliate marker preservation. The UI must make that direct handoff explicit.

## User Outcome

A first-time user can tell before activating a CTA whether the next step is an expaify review page or a provider site, what displayed price expaify currently knows, and which values the provider can still change.

## Hierarchy

Primary:

- Result price and price basis.
- CTA action label.
- Destination metadata: `expaify review` or `provider site`.

Secondary:

- Provider name.
- Handoff disclosure sentence.
- Deal Score content.

Tertiary:

- Technical identifiers on `/book`.
- Disabled-state diagnostic copy.

## Shared CTA Block Pattern

Apply this pattern to `FlightCard` and `HotelCard`.

Layout:

- Wrap the CTA, destination metadata, and disclosure in a single block at the bottom of the card.
- Use `space-y-2` on mobile and desktop.
- CTA is full width on mobile.
- Hotel CTA may remain auto-width at `sm` and above only if the disclosure has `sm:max-w-[18rem]` and right alignment does not compress text below two readable lines.
- Do not use text smaller than `text-xs leading-5` for trust disclosures.
- Do not place disclosure copy outside the CTA block.

Container classes:

- Result-card CTA wrapper: `space-y-2`
- Enabled primary provider CTA: existing `btn-primary` or equivalent `rounded-[var(--radius-control)] bg-[var(--brand)] text-[var(--text-inverse)] shadow-[var(--shadow-btn)]`
- Enabled internal review CTA: `rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-raised)] text-[var(--text-1)]`
- Disabled CTA: `rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-3)] cursor-not-allowed`
- Destination metadata: `text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]`
- Disclosure: `text-xs font-medium leading-5 text-[var(--text-3)]`

The CTA visual order is:

1. Destination metadata.
2. CTA control.
3. Disclosure sentence.

## Flight Result States

### Loading

Current skeleton behavior may remain. CTA skeleton must reserve the full CTA block height so loaded text does not shift the card.

Required skeleton structure:

- One shimmer line for destination metadata, height `h-3`, width `w-28`.
- One shimmer CTA, height `h-12`, full width.
- Two shimmer disclosure lines, height `h-3`, widths `w-full` and `w-3/4`.

No visible placeholder copy.

### External Provider Link

Condition:

- Valid price.
- Safe external `http` or `https` provider link.
- Not an internal Duffel `/book` link.

Destination metadata:

- `Provider site`

CTA label:

- `Continue to provider`

Disclosure:

- `Current fare from {provider}. Final price, availability, baggage fees, and provider terms can change.`

Provider formatting:

- Use the same provider value currently shown to the user.
- If the provider value is empty after trimming, use `the provider`.
- Keep provider casing if it is already display-ready; do not add a new mapping in UI scope unless one already exists.

Behavior:

- Link opens in a new tab.
- Preserve `rel="noopener noreferrer sponsored"`.
- Preserve existing safe URL checks.

ARIA label:

- `Continue to provider for {origin} to {destination}. Current fare {formattedPrice}, {priceBasis}. Opens provider site in a new tab. Final price, availability, baggage fees, and provider terms can change.`

### Internal Flight Review Link

Condition:

- Valid price.
- Internal Duffel `/book` review link.

Destination metadata:

- `expaify review`

CTA label:

- `Review fare`

Disclosure:

- If booking is paused or current `/book` path is review-only: `Current fare from {provider}. expaify review opens next; booking may remain paused and provider terms can change.`
- If in-app booking is enabled: `Current fare from {provider}. expaify review opens next before any traveler details are sent.`

Behavior:

- Link opens in the same tab.
- No external `target`.

ARIA label:

- `Review fare for {origin} to {destination}. Current fare {formattedPrice}, {priceBasis}. Opens expaify review before any provider action.`

### Price Unavailable

Condition:

- Invalid or missing money value.

Disabled label:

- `Price unavailable`

Reason:

- `No confirmed price was returned for this result.`

Behavior:

- Disabled button or status control is not focusable.
- Price panel and CTA reason use the same reason string.
- Do not show provider handoff metadata for this state.

ARIA:

- Price status: `Flight price unavailable. No confirmed price was returned for this result.`
- Disabled CTA status if exposed: `Price unavailable for {origin} to {destination}. No confirmed price was returned for this result.`

### Provider Link Unavailable

Condition:

- Valid price.
- Missing, invalid, or unsafe provider link.

Disabled label:

- `Provider link unavailable`

Reason:

- `Availability cannot be verified from this result.`

Behavior:

- Disabled button or status control is not focusable.
- Keep the displayed price visible because the price can still be used for comparison.
- Do not present a destination metadata label.

ARIA:

- `Provider link unavailable for {origin} to {destination}. Availability cannot be verified from this result.`

## Hotel Result States

### Loading

Current score-loading skeleton may remain. If the whole hotel card is loading in a future state, reserve the same CTA block structure as flight cards.

### Enabled Hotel Review Link

Condition:

- Valid nightly price.
- Valid provider URL.
- `buildHotelBookingHref(hotel)` produces a `/book` review URL.

Destination metadata:

- `expaify review`

CTA label:

- `Review hotel`

Disclosure:

- `Nightly rate before taxes and fees. Provider confirms final total, room availability, cancellation policy, and terms.`

Behavior:

- Link opens `/book` in the same tab.
- Provider handoff remains on `/book`, not on the result card.

ARIA label:

- `Review {hotelName}. Nightly rate {formattedPrice} before taxes and fees. Opens expaify review before provider handoff. Provider confirms final total, room availability, cancellation policy, and terms.`

### Hotel Price Unavailable

Condition:

- Invalid or missing `pricePerNight`.
- Valid provider link may or may not exist.

Disabled label:

- `Price unavailable`

Reason when price only is missing:

- `No confirmed nightly price was returned for this result.`

Reason when price and link are both missing:

- `No confirmed nightly price or valid booking link was returned.`

Behavior:

- Keep hotel identity, rating, and Deal Score panel visible if present.
- Do not build or expose a `/book` href.

ARIA:

- `Hotel price unavailable. {reason}`

### Hotel Provider Link Unavailable

Condition:

- Valid nightly price.
- Missing, invalid, or unsafe provider URL.

Disabled label:

- `Provider link unavailable`

Reason:

- `Availability cannot be verified from this result.`

Behavior:

- Keep the nightly price visible.
- Do not build or expose a `/book` href.

ARIA:

- `Provider link unavailable for {hotelName}. Availability cannot be verified from this result.`

## Booking Review Page States

### Flight Review, Booking Paused

Page title:

- `In-app booking is paused`

Hero message:

- `This fare is preserved for review. expaify is not collecting traveler details, payment information, or creating a provider order from this fare.`

Status panel title:

- `Review-only fare`

Status panel message:

- `Current fare, availability, baggage fees, and provider terms still require provider confirmation.`

Primary action:

- `Back to search`

### Flight Review, Booking Enabled

Page title:

- `Review selected fare`

Hero message:

- Sandbox: `Review this fare in sandbox mode. Submitting will not create a live airline ticket.`
- Live-capable: `Confirm the fare details before expaify sends traveler information to the provider. Final price, availability, baggage fees, and provider terms can still change.`

Form heading:

- `Continue with this fare`

Booking status message:

- Sandbox: `Duffel sandbox mode is active. This is a test provider path and does not create a live airline ticket.`
- Live-capable: `Review fare context before creating the provider order.`

Submit button:

- Loading: `Confirming request...`
- Sandbox: `Confirm sandbox booking`
- Live-capable: `Confirm booking`

Submit note:

- Sandbox: `Sandbox submission only. No live ticket is issued.`
- Live-capable: `expaify sends these details only after you confirm.`

### Flight Review Error

Page title:

- `Review selected fare`

Hero message:

- `The fare details are still available, but the provider stopped the booking request before an order was created.`

Status title:

- `Booking request stopped`

Actions:

- Primary: `Review details again`
- Secondary: `Back to search`

### Invalid Flight Review

Page title:

- `We can't identify this fare`

Hero message:

- `This booking link is missing required fare details or includes trip details expaify cannot verify. Return to search and choose a current flight result before reviewing booking options.`

Status title:

- `Fare context is missing`

Status message:

- `No passenger details, payment details, or provider order can be submitted from this page.`

### Hotel Handoff Review

Page eyebrow:

- `Hotel handoff`

Page title:

- `Review selected hotel`

Hero message:

- `The selected hotel offer is preserved for provider handoff. Taxes, fees, cancellation policy, room details, live availability, and total due require provider confirmation.`

Status title:

- `Provider confirmation required`

Status message:

- `expaify is not creating a hotel reservation. The provider sets the final taxes, fees, policies, room availability, and total due.`

Before-you-continue copy:

- `Compare the hotel name, provider, selected rate, currency, and price basis on the provider page before entering payment details.`

Primary action:

- `Continue to provider`

Secondary action:

- `Back to search`

Primary action ARIA:

- `Continue to provider for {hotelName}. Opens provider site in a new tab. Final total, room availability, cancellation policy, and terms require provider confirmation.`

### Invalid Hotel Review

Page title:

- `We can't identify this hotel`

Hero message:

- `This hotel handoff link is missing required offer details or includes a price, currency, provider, or handoff URL expaify cannot verify. Return to search and choose a current hotel result.`

Status title:

- `Hotel context is missing`

Status message:

- `No reservation, payment details, or provider booking request can be submitted from this page.`

## Responsive Rules

### Mobile, 375px

- Result cards remain single-column.
- CTA block spans full card width.
- Destination metadata appears above the CTA, left aligned.
- CTA text must not truncate unless the viewport is narrower than 320px; use `min-h-12 px-4 text-sm leading-5`.
- Disclosure is left aligned for flights and hotels, `text-xs leading-5`, max width `none`.
- Price and CTA blocks stack with `gap-4`.
- No sticky CTA on result cards.
- `/book` page keeps the existing single-column order: summary first, action/status panel second.
- `/book` sticky form submit may remain, but the note must remain visible above the mobile viewport bottom when focused.

### Desktop, 1280px

- Flight cards may keep their existing card width and internal grid.
- Hotel cards may keep image-first layout.
- CTA metadata, CTA, and disclosure stay visually grouped.
- For hotel cards, right-align CTA content only when the disclosure line length remains readable; otherwise keep left alignment.
- `/book` keeps the existing two-column layout with the action/status panel sticky at `lg`.

## Focus And Keyboard Rules

- Enabled links and buttons use the existing global `:focus-visible` ring from `app/globals.css`.
- Destination metadata and disclosure are not focusable.
- Disabled CTA controls must not receive keyboard focus.
- External provider links must be discoverable by screen readers through the ARIA label, not only through visible disclosure text.
- `/book` invalid states keep moving focus to the hidden heading on mount.
- Error status uses `role="alert"` or assertive live region.
- Loading status uses polite live region.

## Edge Cases

- Missing provider display name: use `the provider` in disclosure copy.
- Long provider names: allow wrapping in disclosure; never truncate the disclosure.
- Long hotel names: visible card title may remain clamped, but ARIA label uses the full hotel name.
- Multi-passenger fare: price basis must say `total trip price for {n} adults` when `priceScope` is `party_total`; otherwise `per person fare for this trip`.
- Low-confidence Deal Score behavior is unchanged.
- Hotel offer with valid price and invalid link shows price but blocks review.
- Flight offer with valid price and invalid link shows price but blocks provider continuation.
- External flight links preserve new-tab behavior and sponsored relation until DEV adds a safe provider URL to flight review context.

## Implementation Acceptance Criteria

- Flight external provider CTA says `Continue to provider`, shows `Provider site`, opens a new tab, and includes the full provider-change disclosure.
- Flight internal review CTA says `Review fare`, shows `expaify review`, opens same tab, and includes the expaify review disclosure.
- Hotel CTA says `Review hotel`, shows `expaify review`, opens same tab, and includes final total, availability, cancellation policy, and terms in the disclosure.
- No enabled CTA uses `Book` copy unless the flow can complete the transaction in-app.
- Every enabled CTA has adjacent `text-xs leading-5` disclosure copy.
- Disabled states use exact labels and reasons from this spec.
- External link ARIA labels include `opens provider site in a new tab`.
- Internal review ARIA labels include `opens expaify review`.
- Mobile 375px and desktop 1280px show no overlapping CTA text, clipped disclosure, or hidden price basis.

## DEV-Stage Follow-Up

To make every flight pass through `/book`, add a DEV ticket to extend `BookingFareContext` with a validated `providerUrl` for external flight providers, preserve affiliate markers on outbound handoff, and render a provider handoff action from the flight review page. This is outside UI-only scope for `UI-BOOKING-HANDOFF-TRUST-01`.
