# UXDES-DEAL-DETAIL-CONTINUITY-01: Deal Detail Continuity Design Spec

## Source Inputs

- Discovery: `docs/pipeline/deal-detail-continuity/01-discovery.md`
- Research: `docs/pipeline/deal-detail-continuity/02-research.md`
- Current audited surfaces:
  - `app/deals/[dealId]/page.tsx`
  - `app/api/deals/[dealId]/route.ts`
  - `lib/deals/dealDetail.ts`
  - `lib/deals/dealDetailTypes.ts`
  - `app/components/DealBadge.tsx`
  - `app/components/DealScorePanel.tsx`
  - `lib/types.ts`
  - `app/globals.css`

## Problem Statement

Users who open a deal detail page must be able to confirm that the detail view preserves the exact price, trip or stay context, Deal Score evidence, freshness, and provider action state that made the originating result worth clicking.

## Design Goal

The detail page is solved when a first-time paid user can scan the first viewport at 375px or 1280px and answer five questions without relying on optional metadata:

- What exact deal did I open?
- What price and price basis is shown?
- What route or stay context does this apply to?
- Why is this considered a deal, and how confident is expaify?
- Can I act on it now, or did the provider action become unavailable?

## Data Contract For UI Implementation

Detail UI must be designed around a continuity model, even if DEV later adapts persistence to match it.

### Shared Fields

- `id: string`
- `kind: "flight" | "hotel"`
- `provider: string`
- `money: { priceCents: number; currency: string }`
- `priceBasis: "traveler_fare" | "passenger_total" | "nightly_before_taxes_fees" | "current_price_unknown_basis"`
- `updatedAt: string`
- `expiresAt?: string`
- `bookingUrl?: string`
- `score: DealScore | null`
- `scoreState: "complete" | "low_confidence" | "partial" | "missing" | "loading"`
- `dataState: "valid" | "missing_context" | "invalid_id" | "missing_row" | "invalid_row" | "store_unavailable"`

Do not name UI state or component props as bare `price`. Use `money`, `currentMoney`, or `displayMoney`. Currency formatting must derive from `{ priceCents, currency }`.

### Flight Continuity Fields

Visible slots must exist for:

- Origin
- Destination
- Depart
- Return
- Carrier
- Stops
- Cabin
- Travelers

Missing field copy:

- Origin: `Origin unavailable`
- Destination: `Destination unavailable`
- Depart: `Depart date unavailable`
- Return: `One-way or return date unavailable`
- Carrier: `Carrier unavailable`
- Stops: `Stops unavailable`
- Cabin: `Cabin unavailable`
- Travelers: `Traveler count unavailable`

### Hotel Continuity Fields

Visible slots must exist for:

- Hotel
- Area
- Check-in
- Check-out
- Nights
- Guests
- Room or rate
- Price basis

Missing field copy:

- Hotel: `Hotel name unavailable`
- Area: `Area unavailable`
- Check-in: `Check-in unavailable`
- Check-out: `Check-out unavailable`
- Nights: `Nights unavailable`
- Guests: `Guest count unavailable`
- Room or rate: `Room or rate unavailable`
- Price basis: `Provider confirms final price and availability.`

## Information Architecture

### Primary

1. Back navigation.
2. Deal identity: kind, provider, route or stay title, freshness, expiration.
3. Current money and price basis.
4. Provider action state.

### Secondary

1. Structured route or stay continuity grid.
2. Deal Score badge and evidence.
3. Provider confirmation helper copy.

### Tertiary

1. Image, if available.
2. Additional metadata that is not already represented in required visible slots.
3. Recovery actions for missing or unavailable detail states.

Image must never be the only carrier of route, stay, price, or score context. If no image exists, show a neutral surface, not shimmer after page load.

## Layout

### Mobile 375px

Order in the first viewport:

1. `Back to search`
2. Kind and provider row
3. H1 identity
4. Money block
5. Compact continuity facts
6. Deal Score state
7. Updated time and CTA state

The image, long metadata, and secondary context can appear below those facts. Do not place the image before price and context on mobile.

Tailwind pattern:

```tsx
<main className="min-h-screen bg-[color:var(--bg-base)] px-4 py-5 text-[color:var(--text-1)]">
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <a className="btn-pill w-fit" />
    <section className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:order-1" />
        <aside className="border-t border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 lg:order-2 lg:border-l lg:border-t-0" />
      </div>
    </section>
  </div>
</main>
```

### Desktop 1280px

Use a two-column layout:

- Left column: identity, money, continuity grid, Deal Score evidence, metadata.
- Right column: action panel, freshness, provider confirmation, image.

The right action panel may be sticky only if it does not overlap page content and remains keyboard reachable in DOM order after the primary facts.

Tailwind pattern:

```tsx
<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
  <section className="flex min-w-0 flex-col gap-4" />
  <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5 lg:self-start" />
</div>
```

## Component Spec

### Header And Identity

Flight H1 format:

- `{origin} to {destination}`
- If either side missing: `Flight deal details`

Flight subtitle format:

- `{depart}{returnText} · {carrier} · {stopsText} · {cabinText}`
- Missing slots use the field-level unavailable copy.

Hotel H1 format:

- `{hotelName}`
- If missing: `Hotel deal details`

Hotel subtitle format:

- `{area} · {checkIn} to {checkOut} · {nightsText} · {guestsText}`
- Missing slots use the field-level unavailable copy.

Visible labels:

- Kind pill: `Flight deal` or `Hotel deal`
- Provider pill: `{provider}`
- Freshness label: `Updated {formattedDateTime}`
- Expiration label when future: `Expires {formattedDateTime}`
- Expiration label when past: `Expired {formattedDateTime}`

Tailwind pattern:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span className="btn-pill cursor-default">{kindLabel}</span>
  <span className="btn-pill active cursor-default">{provider}</span>
  <span className="btn-pill cursor-default">{freshnessCopy}</span>
</div>
<h1 className="font-display text-2xl font-extrabold leading-tight tracking-normal text-[color:var(--text-1)] sm:text-3xl">
  {identity}
</h1>
<p className="text-sm font-medium leading-6 text-[color:var(--text-2)]">{subtitle}</p>
```

### Money Block

Labels:

- `Traveler fare` for one traveler or per-person fare.
- `Passenger total` for known party total.
- `Nightly rate before taxes and fees` for hotel nightly rates.
- `Current price` when basis is unknown.

Helper copy:

- Flight traveler fare: `Shown for one traveler unless the result says otherwise.`
- Flight passenger total: `Shown for the travelers in this search.`
- Hotel nightly: `Taxes, fees, cancellation policy, and final total are confirmed by the provider.`
- Unknown basis: `Provider confirms final price and availability.`

Tailwind pattern:

```tsx
<section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
  <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">{priceLabel}</p>
  <p className="mt-1 font-display text-4xl font-extrabold leading-none tracking-normal text-[color:var(--text-1)] tabular-nums">
    {formattedMoney}
  </p>
  <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-2)]">{priceHelper}</p>
</section>
```

### Continuity Facts

Use a visible grid with required slots. Do not silently omit missing fields.

Tailwind pattern:

```tsx
<section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4">
  <h2 className="text-sm font-bold text-[color:var(--text-1)]">Trip details</h2>
  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <Fact label="Origin" value={origin ?? "Origin unavailable"} tone={origin ? "normal" : "muted"} />
  </div>
</section>
```

Flight section title: `Trip details`

Hotel section title: `Stay details`

Unavailable fact values use `text-[color:var(--text-3)]` and do not rely on warning color.

### Deal Score

Use shared `DealBadge` and `DealScorePanel` semantics.

States:

- Loading: show `Checking recent price history`.
- Complete high confidence: show `Great`, `Good`, or `Typical`, with `Usual`, `Vs usual`, `Window`, percentile, and explanation.
- Low confidence: badge is `Limited history`; do not show `Great` as a confirmed rating. Include rule copy.
- Partial evidence: render unavailable panel, not a partial confident verdict.
- Missing evidence: render unavailable panel.

Required copy:

- Unavailable flight: `We do not have enough route history to score this fare right now.`
- Unavailable hotel: `We do not have enough hotel history to score this nightly rate right now.`
- Partial evidence: `Saved score evidence is incomplete, so expaify is not showing a deal rating for this detail.`
- Low confidence: `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.`
- Window label: `Last 90 days`

Complete evidence requires all fields:

- `percentile`
- `pctVsMedian`
- `medianCents`
- `currency`
- `verdict`
- `confidence`
- `explanation`

Tailwind pattern: use the existing `DealScorePanel` class conventions:

```tsx
<DealScorePanel
  score={completeScore}
  loading={scoreState === "loading"}
  scope={kind === "flight" ? "route" : "hotel"}
  priceNoun={kind === "flight" ? "fare" : "nightly rate"}
  unavailableCopy={scoreUnavailableCopy}
/>
```

### Provider Action Panel

The action panel must always answer whether the user can act now.

Valid active state:

- Button text: `Check availability with {provider}`
- Helper: `Opens the provider site. Prices and availability can change.`
- Link attrs: `target="_blank"` and `rel="nofollow sponsored noopener noreferrer"`

Missing booking URL:

- Heading: `Provider link unavailable`
- Body: `This saved deal can be reviewed here, but expaify does not have a current external booking link.`
- Disabled control text: `Unavailable`

Expired:

- Heading: `Deal expired`
- Body: `This saved deal may no longer be available at the shown price. Search again to find current options.`
- Primary recovery: `Search current deals`

Invalid external URL:

- Heading: `Provider link unavailable`
- Body: `The saved provider link is not valid, so expaify is not sending you offsite.`
- Disabled control text: `Unavailable`

Tailwind pattern:

```tsx
<aside className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
  <a className="btn-primary" />
  <p className="mt-2 text-center text-xs font-medium leading-5 text-[color:var(--text-2)]" />
</aside>
```

Unavailable panel pattern:

```tsx
<div className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] p-4" role="status">
  <p className="text-sm font-bold text-[color:var(--text-1)]">{heading}</p>
  <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">{body}</p>
  <button className="btn-primary mt-3" disabled>Unavailable</button>
</div>
```

## Page States

### Valid Detail

Render identity, money, continuity facts, Deal Score, updated time, and action panel.

No required visible slot may disappear. Missing continuity values render with unavailable copy.

### Loading

For client-side detail fetch or route transition:

- Keep page skeleton within stable dimensions.
- Skeleton copy must be accessible through `role="status"` and `aria-label="Loading deal details."`
- Do not show a shimmer as if missing imagery is still loading after data has resolved.

Visible copy:

- `Loading deal details`
- `Checking recent price history`

### Missing Context

Render the detail if price, provider, and at least kind are valid, but mark the continuity area incomplete.

Banner copy:

- Heading: `Some deal details are missing`
- Body: `expaify can show the saved price and provider, but some route or stay context was not saved with this deal.`

### Expired Deal

When `expiresAt` is before current time:

- Keep detail visible.
- Show `Expired {formattedDateTime}` near the provider and in action panel.
- Disable provider CTA even if `bookingUrl` exists unless DEV explicitly verifies provider action freshness.
- Offer `Search current deals`.

### Stale Deal

When `updatedAt` is older than 6 hours and the deal is not expired:

- Keep CTA active if valid, but add freshness warning.

Copy:

- Heading: `Price may be stale`
- Body: `This deal was last updated more than 6 hours ago. The provider confirms the current price and availability.`

### Missing Booking URL

Keep page visible. Do not 404.

Action state copy is defined in Provider Action Panel.

### Invalid Deal ID

Recoverable page, no inferred price or score.

Copy:

- H1: `Deal link is not valid`
- Body: `This deal link does not match an expaify deal format.`
- Action: `Back to search`

### Missing Deal Row

Recoverable page, no inferred price or score.

Copy:

- H1: `Deal details unavailable`
- Body: `This saved deal could not be found. It may have been removed or replaced by newer prices.`
- Action: `Back to search`

### Invalid Row

Recoverable page, no inferred price or score.

Copy:

- H1: `Deal details unavailable`
- Body: `expaify could not safely display this saved deal because required price or provider data is incomplete.`
- Action: `Back to search`

### Missing Data Store

Recoverable page, no inferred price or score.

Copy:

- H1: `Deal details unavailable right now`
- Body: `Saved deal details are temporarily unavailable. Search results may still show current options.`
- Primary action: `Back to search`

## Metadata Rules

Only render metadata after required continuity slots.

Never duplicate fields already shown in identity, money, continuity facts, score evidence, freshness, or action panel.

Metadata section title:

- `More details`

Empty metadata:

- Do not render the metadata section.

Long values:

- Use wrapping, not truncation, for user-critical data such as airport names, hotel names, and dates.
- Non-critical metadata can use `[overflow-wrap:anywhere]`.

## Accessibility And Keyboard

Tab order:

1. Back to search
2. Active provider CTA, if available
3. Search current deals recovery action, if present
4. Any secondary links

Unavailable controls:

- Disabled buttons must be accompanied by visible explanatory text.
- Do not rely on disabled button text alone.

ARIA:

- Loading container: `role="status"` with `aria-label="Loading deal details."`
- Deal Score unavailable: `role="status"` with scope-specific aria label from `DealScorePanel`.
- Missing context banner: `role="status"`
- Fatal unavailable state: H1 plus normal page content; no modal.

Focus:

- Use existing global `:focus-visible` and `--focus-ring`.
- Do not remove outlines.

Color:

- All warning, error, and unavailable states must include explicit text labels.
- Do not communicate expired, stale, low-confidence, or unavailable states by color only.

## Final UI Copy Inventory

- `Back to search`
- `Flight deal`
- `Hotel deal`
- `Trip details`
- `Stay details`
- `Traveler fare`
- `Passenger total`
- `Nightly rate before taxes and fees`
- `Current price`
- `Shown for one traveler unless the result says otherwise.`
- `Shown for the travelers in this search.`
- `Taxes, fees, cancellation policy, and final total are confirmed by the provider.`
- `Provider confirms final price and availability.`
- `Deal Score`
- `Checking recent price history`
- `Deal Score unavailable`
- `We do not have enough route history to score this fare right now.`
- `We do not have enough hotel history to score this nightly rate right now.`
- `Saved score evidence is incomplete, so expaify is not showing a deal rating for this detail.`
- `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.`
- `Last 90 days`
- `Updated {date}`
- `Expires {date}`
- `Expired {date}`
- `Check availability with {provider}`
- `Opens the provider site. Prices and availability can change.`
- `Provider link unavailable`
- `This saved deal can be reviewed here, but expaify does not have a current external booking link.`
- `The saved provider link is not valid, so expaify is not sending you offsite.`
- `Deal expired`
- `This saved deal may no longer be available at the shown price. Search again to find current options.`
- `Search current deals`
- `Price may be stale`
- `This deal was last updated more than 6 hours ago. The provider confirms the current price and availability.`
- `Some deal details are missing`
- `expaify can show the saved price and provider, but some route or stay context was not saved with this deal.`
- `Deal link is not valid`
- `This deal link does not match an expaify deal format.`
- `Deal details unavailable`
- `This saved deal could not be found. It may have been removed or replaced by newer prices.`
- `expaify could not safely display this saved deal because required price or provider data is incomplete.`
- `Deal details unavailable right now`
- `Saved deal details are temporarily unavailable. Search results may still show current options.`
- `More details`

## UI Acceptance Criteria

- Flight details always reserve visible slots for origin, destination, depart, return, carrier, stops, cabin, and travelers.
- Hotel details always reserve visible slots for hotel, area, check-in, check-out, nights, guests, room or rate, and price basis.
- Price display uses `{ priceCents, currency }` naming and basis-specific labels; no bare `price` UI state is introduced.
- Complete score evidence uses `DealBadge` and `DealScorePanel` semantics.
- Low-confidence score shows `Limited history` and never presents `Great` as confirmed.
- Partial score evidence renders unavailable or incomplete evidence copy, not a confident verdict.
- Missing booking URL, invalid URL, expired deal, stale deal, invalid ID, missing row, invalid row, and missing data-store states have explicit recoverable copy.
- At 375px, price, continuity context, Deal Score state, updated time, and action state appear before long metadata or imagery.
- At 1280px, identity and money remain primary, Deal Score evidence secondary, and provider action visible in the right column.
- Keyboard and assistive-tech users can understand every unavailable state without relying on color.

## Handoff To UI

Implement UI only against this spec first. If data shape changes are required to distinguish invalid ID, missing row, invalid row, and store unavailable, create or continue a DEV ticket after UI wiring identifies the exact logic boundary.
