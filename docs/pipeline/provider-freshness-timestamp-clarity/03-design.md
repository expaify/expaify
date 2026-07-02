# UXDES-PROVIDER-FRESHNESS-TIMESTAMP-CLARITY-01: Provider Freshness Timestamp Clarity

## Upstream Inputs

- Discovery: `docs/pipeline/provider-freshness-timestamp-clarity/01-discovery.md`
- Research: `docs/pipeline/provider-freshness-timestamp-clarity/02-research.md`
- Affected UI: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `components/flights/FlightResults.tsx`
- Current data contract: `NormalizedFare.source`, `NormalizedFare.fetchedAt`, and `HotelOffer.source` in `lib/types.ts`

## Design Goal

Paid users must be able to answer "who supplied this price?" and "when did expaify last check it?" in the same decision context as the fare or nightly rate, without interpreting a displayed price as guaranteed or freshly rechecked at click time.

## Scope

This UI spec covers:

- Flight result card collapsed state.
- Flight result card expanded details.
- Flight results summary and mobile filter summary.
- Hotel result card collapsed state.
- Hotel result card expanded details.
- Loading, empty, missing metadata, invalid timestamp, unavailable price, mobile, desktop, focus, and keyboard states.

This spec does not require a provider re-check, booking flow change, cache policy change, or new hotel timestamp field. Hotel freshness must remain explicit as unavailable until a real `HotelOffer.fetchedAt` field is added by a DEV-stage ticket.

## Hierarchy

### Flight Card

- Primary: route, carrier, current fare amount, Deal Score, primary CTA.
- Secondary: provider freshness line, stops, departure time, price scope.
- Tertiary: baggage estimate, expanded schedule, cabin, handoff explanation.

Provider freshness is secondary but must sit visually adjacent to the price because it qualifies trust in the displayed amount.

### Hotel Card

- Primary: hotel name, nightly rate, Deal Score, primary CTA.
- Secondary: provider identity and unavailable freshness line, rating, price basis.
- Tertiary: photo fallback, expanded handoff terms.

Hotel freshness must not be made visually equivalent to a real timestamp. The user should see provider identity, then a clear unavailable timestamp fallback.

### Flight Results Summary

- Primary: result count and active controls.
- Secondary: lowest live fare, freshness of visible fares, sort/filter state.
- Tertiary: Great deal count, nonstop count, baggage sorting help.

Aggregate freshness should be concise and visible without pushing controls below the fold at 375px.

## Formatting Rules

### Provider Names

Use a shared display helper for consistency:

- `travelpayouts` -> `Travelpayouts`
- `duffel` -> `Duffel`
- `amadeus` -> `Amadeus`
- `kiwi` -> `Kiwi`
- `hotellook` -> `Hotellook`
- `bookingComRapidApi` -> `Booking.com`
- Any unknown non-empty source -> trim and preserve readable casing if already present; otherwise title-case hyphen/underscore-separated words.
- Empty or whitespace-only source -> `Provider unavailable`

Do not expose raw internal IDs in visible copy when a known display label exists.

### Relative Freshness

For valid flight `fetchedAt` values, derive relative copy from the timestamp and the user's current time:

- Less than 1 minute: `Checked just now by <Provider>`
- 1-59 minutes: `Checked <N> min ago by <Provider>`
- 1-23 hours: `Checked <N> hr ago by <Provider>`
- 24-47 hours: `Checked yesterday by <Provider>`
- 2-6 days: `Checked <N> days ago by <Provider>`
- 7 days or older: `Checked on <Mon D> by <Provider>`

Use `Intl.RelativeTimeFormat` or a deterministic equivalent. Do not show seconds. Do not render `Invalid Date`.

### Absolute Freshness

Expanded details use absolute local time:

- Same year: `<Mon D>, <h:mm AM/PM>`
- Different year: `<Mon D, YYYY>, <h:mm AM/PM>`

Example: `Last checked by Duffel on Jul 2, 9:18 AM. Final price and availability are confirmed by the provider.`

### Timestamp Validity

A timestamp is valid only when `new Date(fetchedAt).getTime()` is finite. Empty strings, missing values, malformed strings, and unparseable dates are invalid.

If the timestamp is invalid:

- Collapsed flight copy: `Provider freshness unavailable`
- Expanded flight copy with provider: `Last-checked time unavailable for <Provider>. Final price and availability are confirmed by the provider.`
- Accessible copy must use the same fallback.

If provider is unavailable but timestamp is valid:

- Collapsed flight copy: `Checked <relative time>; provider unavailable`
- Expanded flight copy: `Last checked on <absolute time>. Provider name unavailable. Final price and availability are confirmed by the provider.`

## Flight Card Spec

### Collapsed Default State

Add a trust line directly under the current fare amount in the existing `Price` block. The line must be visible on mobile and desktop; replace the current desktop-only price label location with a two-line metadata stack.

Visible copy:

- Line 1: existing price basis, for example `per person fare for this trip`
- Line 2: freshness, for example `Checked 12 min ago by Duffel`

Mobile layout:

- Keep the price block right-aligned.
- Allow the freshness line to wrap to two lines.
- Do not truncate freshness copy.
- If the price column would become too narrow, make the card top grid `grid-cols-[minmax(0,1fr)_minmax(6.75rem,auto)]` and use `max-w-[9.5rem]` for the price metadata on 375px.

Tailwind pattern:

```tsx
<div className="min-w-[6.75rem] max-w-[9.5rem] text-right sm:min-w-[7.5rem] sm:shrink-0">
  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">...</p>
  <p className="mt-1 font-display text-xl font-black leading-none text-[var(--text-1)] tabular-nums sm:text-4xl">...</p>
  <div className="mt-1 space-y-0.5 text-[11px] font-semibold leading-4 text-[var(--text-3)]">
    <p>{priceLabel}</p>
    <p className="text-[var(--text-2)]">{freshnessLabel}</p>
  </div>
</div>
```

### Collapsed Loading State

Current skeleton cards must not show fake provider or freshness copy.

Requirements:

- Keep shimmer blocks only.
- Do not announce freshness via `aria-live`.
- Loading state copy outside the cards remains `Checking live flight inventory`.

### Collapsed Price Unavailable State

If `fare` exists but `fare.price` is invalid:

- Keep `Price unavailable`.
- Show unavailable reason.
- Show provider/freshness only if source or valid timestamp exists.

Visible copy examples:

- `No confirmed price was returned.`
- `Checked 18 min ago by Travelpayouts`
- If invalid timestamp: `Provider freshness unavailable`

### Expanded Default State

In the existing provider handoff block, insert a dedicated provider freshness subsection before the current `Provider handoff` subsection.

Visible copy:

- Heading: `Price check`
- Body for valid timestamp and provider: `Last checked by <Provider> on <Mon D>, <h:mm AM/PM>. Final price and availability are confirmed by the provider.`
- Body for invalid timestamp: `Last-checked time unavailable for <Provider>. Final price and availability are confirmed by the provider.`

Tailwind pattern:

```tsx
<p className="mt-2 font-bold text-[var(--text-1)]">Price check</p>
<p>{absoluteFreshnessCopy}</p>
```

Keep existing `Provider handoff` copy, but update it so it does not duplicate the collapsed freshness phrase. It should explain finality and destination:

- Internal review: `expaify review opens next; booking may remain paused and provider terms can change.`
- External provider: `Final price, availability, baggage fees, and provider terms can change.`

### Flight CTA Accessibility

CTA `aria-label` must include the same trust state as visible text.

Valid timestamp example:

`Continue to provider for SFO to JFK. Current fare $219, per person fare for this trip. Checked 12 min ago by Duffel. Opens provider site in a new tab. Final price, availability, baggage fees, and provider terms can change.`

Invalid timestamp example:

`Review fare for SFO to JFK. Current fare $219, per person fare for this trip. Provider freshness unavailable. Opens expaify review before any provider action.`

Disabled CTA labels must include provider/freshness only after the failure reason, not before it.

### Focus And Keyboard

- The freshness line is static text and must not receive focus.
- Existing CTA and Details button tab order remains unchanged.
- Details toggles with Enter and Space through the native button.
- When expanded, the new `Price check` text appears in DOM order before `Provider handoff`.
- Focus must remain on the Details button after expansion; do not auto-focus static detail text.

## Flight Results Summary Spec

### Aggregate Freshness

Compute freshness from `displayFlights`, not the full unfiltered `flights` array, because the summary describes visible results.

States:

- No visible fares and not searching: no freshness summary.
- Searching with no visible fares: keep existing loading language; do not invent freshness.
- All visible fares have valid timestamps: `Freshest fare checked <relative time>`
- Some visible fares have invalid or missing timestamps: `Some fare timestamps unavailable`
- Visible fares have no valid timestamps: `Fare freshness unavailable`

If all valid timestamps are older than 6 hours, append a trust warning:

- `Freshest fare checked <relative time>. Recheck provider price before booking.`

This warning is copy-only; do not block booking.

### Desktop Placement

Replace the third desktop metric card (`Nonstop options`) only if three cards must remain. Preferred layout is four equal cards at `lg:grid-cols-4`:

1. Lowest live fare
2. Freshness
3. Great deals
4. Nonstop options

Freshness card copy:

- Label: `Freshness`
- Value: relative freshest time, for example `12 min ago`
- Detail: `Provider timestamps on visible fares.`

Fallback values:

- Some invalid timestamps: value `Partial`, detail `Some fare timestamps unavailable.`
- No valid timestamps: value `Unavailable`, detail `Provider freshness is missing.`
- Loading: value `Waiting`, detail `Provider timestamps appear as fares arrive.`

Tailwind pattern:

```tsx
<div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Freshness</p>
  <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">{freshnessMetric}</p>
  <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-2)]">{freshnessDetail}</p>
</div>
```

### Mobile Placement

Append a short freshness clause to the mobile summary only when fares exist.

Pattern:

`<visible> of <total> fares | <Sort> | <Stops> | Freshest <relative>`

Fallbacks:

- `| Freshness partial`
- `| Freshness unavailable`

Do not exceed one line by force. The current mobile summary may truncate visually, but the full value must remain in `aria-describedby="flight-results-controls-summary"` for sort and stop buttons.

### Live Region

The existing `flight-results-controls-summary` live region should include the aggregate freshness sentence after sort/filter copy:

`Showing 8 of 12 fares, sorted by deal score with all stops selected. Freshest fare checked 12 min ago.`

## Hotel Card Spec

### Collapsed Default State

Add provider trust copy directly under the nightly rate amount in the existing `Price` block.

Visible copy:

- Line 1: `per night before taxes and fees`
- Line 2: `Rate from <Provider>`
- Line 3: `Last-checked time unavailable`

Line 3 should use warning tone because it is a missing trust field, not a normal metadata detail.

Tailwind pattern:

```tsx
<div className="mt-1 space-y-0.5 text-[11px] font-semibold leading-4">
  <p className="text-[color:var(--text-3)]">per night before taxes and fees</p>
  <p className="text-[color:var(--text-2)]">Rate from {providerName}</p>
  <p className="text-[color:var(--warning)]">Last-checked time unavailable</p>
</div>
```

### Collapsed Loading State

If hotel loading skeletons are added later, they must not show fake provider or freshness copy.

### Collapsed Price Unavailable State

If price is invalid:

- Keep `Price unavailable`.
- Show the existing unavailable reason.
- Add `Rate from <Provider>` only when `hotel.source` is non-empty.
- Add `Last-checked time unavailable`.

### Expanded Default State

In the existing provider handoff block, add a dedicated price check subsection before `Provider handoff`.

Visible copy:

- Heading: `Rate check`
- Body: `Rate from <Provider>. Last-checked time unavailable.`

Update provider handoff body to:

`Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.`

If booking is unavailable, keep the unavailable reason after the handoff copy.

### Hotel CTA Accessibility

CTA `aria-label` must include provider and unavailable freshness:

`Review <Hotel Name>. Nightly rate <price> before taxes and fees. Rate from <Provider>. Last-checked time unavailable. Opens expaify review before provider handoff. Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.`

Unavailable CTA/status accessible text must include:

`Last-checked time unavailable.`

## Empty And Error States

### Flight Empty Results

Do not show provider/freshness copy when no fare objects exist.

Existing empty copy remains valid:

- Missing date.
- Filters hide results.
- Provider unavailable.
- No current fares matched.

If provider notices are displayed, do not add freshness because no per-fare timestamp exists.

### Hotel Empty Results

No new empty state is required by this ticket. If no hotel offers exist, do not show provider/freshness copy.

### Invalid Metadata

Invalid timestamp and missing provider are UI data-quality states, not app errors. They must render graceful fallback copy and must not throw.

## Responsive Requirements

### Mobile 375px

- Flight and hotel price blocks must remain within the card width.
- Freshness/provider lines can wrap; they must not overlap the amount, Deal Score chip, or CTA.
- CTA max width can remain `max-w-[8.5rem]`, but label truncation must not hide provider/freshness because that metadata is outside the CTA.
- Expanded `Price check` and `Rate check` copy should use existing `text-xs leading-5` and wrap naturally.
- Flight results mobile summary may visually truncate, but the full freshness sentence must remain in the controls live region.

### Desktop 1280px

- Flight result cards remain in the existing multi-column grid.
- Price metadata must not cause card height jitter beyond normal wrapping.
- Flight summary uses four metric cards at `lg:grid-cols-4` when space allows; at `sm` and `md`, use two columns or the current grid density without nesting cards.

## Accessibility Requirements

- Visible provider/freshness copy must have an equivalent in CTA accessible names or the controls summary live region.
- Do not use color alone to communicate missing freshness. The string `Last-checked time unavailable` must be visible.
- Static metadata must not be focusable.
- All existing focus rings must remain token-based: `focus-visible:outline-[var(--border-focus)]` or global `:focus-visible`.
- Loading skeletons must not announce provider or freshness.
- Use `aria-live="polite"` only for the aggregate flight controls summary, not per-card timestamp updates.

## Implementation Notes For UI Stage

- Create small local helpers or shared pure helpers for provider labels and freshness formatting. Keep them deterministic and unit-testable.
- Do not change API routes for flight freshness; use `fare.fetchedAt`.
- Do not add fake hotel timestamps.
- If adding `HotelOffer.fetchedAt` is desired later, hand off to DEV because it changes provider/data contracts.
- Preserve existing props and exports for `FlightCard`, `HotelCard`, and `FlightResults`.

## Acceptance Criteria

1. A flight card with valid `source` and `fetchedAt` visibly shows `Checked <relative time> by <Provider>` beside the fare amount.
2. A flight card with invalid or missing `fetchedAt` visibly shows `Provider freshness unavailable` and never renders `Invalid Date`.
3. Expanded flight details include `Price check` with absolute last-checked copy and provider finality copy.
4. Flight CTA accessible labels include provider/freshness state.
5. Flight results summary includes freshness for visible fares on desktop and in the mobile controls summary/live region.
6. Hotel cards visibly show `Rate from <Provider>` and `Last-checked time unavailable` near the nightly rate.
7. Expanded hotel details include `Rate check` and the final provider-confirmation copy.
8. Hotel CTA accessible labels include provider identity and `Last-checked time unavailable`.
9. At 375px, provider/freshness lines wrap without overlapping price, score, or CTA.
10. At 1280px, the summary and result card layout remain scannable with no nested cards or decorative clutter.

## Downstream Handoff

Create `UI-PROVIDER-FRESHNESS-TIMESTAMP-CLARITY-01` for UI implementation. No DEV ticket is required for this UI-only version because flight freshness already exists and hotel freshness is explicitly unavailable. A later DEV ticket is appropriate only if product requires true hotel `fetchedAt` parity.
