# UX Design: Hotel Location Decision Context

## Inputs

- Discovery: `docs/pipeline/hotel-location-decision-context/01-discovery.md`
- Research: `docs/pipeline/hotel-location-decision-context/02-research.md`
- Audited surfaces:
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `lib/types.ts`
  - `lib/booking/config.ts`
  - `app/globals.css`

## Problem Statement

Hotel cards and hotel handoff review do not expose trustworthy location precision, so paid-intent users cannot judge stay convenience before leaving expaify for the provider.

## Design Goal

A user comparing hotels must see the best available location context in the collapsed card, expanded details, and `/book` review, with precise labels that never imply an address, distance, map position, or neighborhood unless provider data supports it.

## Information Hierarchy

### Hotel Result Card

1. Primary: hotel name, nightly rate, Review hotel action.
2. Secondary: location label and location value, Deal Score status, stars/rating.
3. Tertiary: price scope, provider confirmation copy, technical rating detail.

### Expanded Hotel Details

1. Primary: Deal Score explanation and location confidence.
2. Secondary: price scope and provider handoff confirmation.
3. Tertiary: hotel photo and rating badge.

### Hotel Handoff Review

1. Primary: hotel name, selected rate, Continue to provider action.
2. Secondary: location label/value and precision note.
3. Tertiary: provider, currency, price basis, technical reference.

## Location Data Contract

The UI should consume a structured location object when available. This requires a DEV stage because current `HotelOffer` and `BookingHotelContext` only preserve `area`.

```ts
type HotelLocationPrecision = 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'

type HotelLocationContext = {
  label: string
  precision: HotelLocationPrecision
  address?: string
  lat?: number
  lng?: number
  distance?: {
    value: number
    unit: 'mi' | 'km'
    referencePoint: string
  }
  providerLocationName?: string
}
```

Required model changes:

- `HotelOffer.location?: HotelLocationContext`
- Keep `HotelOffer.area` temporarily for backward compatibility until all providers and URLs migrate.
- `BookingHotelContext.location?: HotelLocationContext`
- `/book` URL serialization must preserve only validated scalar location fields. Do not pass raw provider JSON.

Location derivation rules:

- Exact address available: `precision = 'exact'`, `label = address`.
- Coordinates without address: `precision = 'coordinates'`, `label = providerLocationName || area || searched destination`.
- Provider area/neighborhood only: `precision = 'area'`, `label = providerLocationName || area`.
- Search fallback only: `precision = 'search_area'`, `label = searched destination or airport display name`.
- No usable location: `precision = 'missing'`, `label = ''`.

Never display distance unless `distance.value`, `distance.unit`, and `distance.referencePoint` are all present from a provider or trusted internal geocoder.

## Final UI Copy

Location labels:

- Exact address: `Exact location`
- Coordinates only: `Map position`
- Provider area only: `Area`
- Search fallback only: `Search area`
- Missing: `Location unavailable`

Precision notes:

- Exact address: `Provider-supplied address. Confirm final address before payment.`
- Coordinates only: `Provider-supplied map position. Confirm final address before payment.`
- Area only: `Provider supplied an area, not a street address.`
- Search fallback: `Only the searched destination is available. Confirm location with the provider.`
- Missing: `No provider location details were returned.`

Card fallback values:

- Missing value text: `Confirm with provider`
- Current legacy `hotel.area` maps to label `Area` and note `Provider supplied an area, not a street address.`

Hotel handoff intro:

- Existing title remains: `Review selected hotel`
- Message becomes: `The selected hotel offer is preserved for provider handoff. Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment.`

Before you continue copy:

`Compare the hotel name, location, provider, selected rate, currency, and price basis on the provider page before entering payment details.`

## Component Specification

### Collapsed Hotel Card

Add a location row directly under the hotel name/rating block and before the price/action row.

Content pattern:

- First line: `{locationLabel}`
- Second line: `{locationValue}`

Examples:

- `Exact location` / `120 Huntington Ave, Boston`
- `Area` / `Back Bay`
- `Search area` / `Boston`
- `Location unavailable` / `Confirm with provider`

Visual treatment:

- Use compact metadata styling, not a badge.
- A small leading location icon may be used if an existing icon package is present; otherwise use text only.
- Value wraps naturally to two lines at 375px.
- Missing and search fallback states use `text-[color:var(--warning)]` for the label only; the value remains `text-[color:var(--text-2)]`.

Tailwind pattern:

```tsx
<div className="mt-2 min-w-0 text-xs leading-5">
  <p className="font-bold text-[color:var(--text-2)]">{locationLabel}</p>
  <p className="break-words font-medium text-[color:var(--text-2)]">{locationValue}</p>
</div>
```

Warning label modifier:

```tsx
className="font-bold text-[color:var(--warning)]"
```

### Expanded Hotel Details

Add a `Location` section above `Provider handoff` in the existing details panel.

Content:

- Heading: `Location`
- Fact line: `{locationLabel}: {locationValue}`
- Note: one precision note from the copy table.
- Optional distance line only when complete trusted distance data exists: `{distance.value} {distance.unit} from {distance.referencePoint}`

Tailwind pattern:

```tsx
<div className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[color:var(--text-2)]">
  <p className="font-bold text-[color:var(--text-1)]">Location</p>
  <p className="mt-1 break-words">
    <span className="font-semibold text-[color:var(--text-2)]">{locationLabel}: </span>
    {locationValue}
  </p>
  <p className="mt-2 text-[color:var(--text-2)]">{precisionNote}</p>
</div>
```

For `search_area` and `missing`, the note uses:

```tsx
className="mt-2 font-semibold text-[color:var(--warning)]"
```

### Hotel Handoff Review

`HotelSummary` must show location even when only fallback precision exists.

Header area:

- Under hotel name, show `{locationLabel}: {locationValue}`.
- Under that, show the precision note.

Facts grid:

- Add `Location` fact with the value.
- Add `Location precision` fact with the label.
- Keep provider, price basis, currency, and technical reference.

Tailwind pattern:

```tsx
<p className="mt-2 break-words text-sm font-semibold leading-6 text-[color:var(--text-2)]">
  {locationLabel}: {locationValue}
</p>
<p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-3)]">
  {precisionNote}
</p>
```

For warning precision:

```tsx
className="mt-1 text-xs font-semibold leading-5 text-[color:var(--warning)]"
```

## Required States

### Default

- Hotel card always shows location row.
- Expanded details always show Location section.
- `/book` always shows location in header and facts grid.

### Loading

- Existing `Score pending` state remains unchanged.
- Location row does not skeletonize if offer data is already present.
- If hotel offers are rendering while score loads, location remains visible and stable.

### Empty Results

- No change to empty hotel inventory copy.
- Do not show a generic map or placeholder location module when there are no hotel cards.

### Error

- If provider search fails and no hotel offers render, no location module appears.
- If a returned hotel lacks location, render `Location unavailable` / `Confirm with provider` and keep Review hotel available when price and deeplink are valid.

### Mobile 375px

- Card grid remains `grid-cols-[4.5rem_minmax(0,1fr)_auto]`.
- Location row stays inside the middle content column below stars/rating.
- Long values wrap with `break-words`; no horizontal scrolling.
- Price column keeps `min-w-[5.75rem]`; location text must not push into it.
- Expanded Location section appears before provider handoff copy and uses full card width.

### Desktop 1280px

- Collapsed cards keep a single scan line when values are short.
- Expanded details use the existing vertical stack.
- Booking review keeps the current two-column shell with the handoff panel sticky on the right.

### Focus And Keyboard

- Details button behavior remains `aria-expanded` and `aria-controls`.
- Location section is static readable content and does not receive tab focus.
- If a future map or provider location link is added, accessible name must include hotel name and precision, for example `View map position for The Eliot Hotel. Provider-supplied map position.`
- Continue to provider remains after the Before you continue checklist in tab order.

### Edge Cases

- Address longer than 80 characters: wrap, do not truncate.
- Airport code fallback: if only `BOS` is available, UI should prefer an airport display name if resolver data exists. If not, show `BOS` under `Search area`, never `Exact location`.
- Coordinates without provider name: show `Map position` / `Provider map position`.
- Distance without reference point: suppress distance entirely.
- Missing `location` but present legacy `area`: show `Area` using `hotel.area`.
- Missing `location` and empty legacy `area`: show `Location unavailable` / `Confirm with provider`.

## Acceptance Criteria

- A hotel with exact address data displays `Exact location` in the card, details, and booking review.
- A hotel with only coordinates displays `Map position` and never displays a street address.
- A hotel with only current `area` data displays `Area` and never uses address, distance, or map language.
- A hotel with only searched destination fallback displays `Search area` and a warning precision note.
- A hotel with no location context displays `Location unavailable` without blocking price, Deal Score, or Review hotel.
- `/book` preserves the same location label/value/precision note visible on the card.
- The Before you continue checklist includes `location`.
- Mobile 375px and desktop 1280px layouts show location without overlapping price, Deal Score, booking availability, or provider confirmation disclosures.
- Keyboard users can expand Details and read Location before Provider handoff content.

## Implementation Notes For Handoff

- UI work can introduce presentation helpers for `getHotelLocationDisplay(hotel)` and `getHotelLocationPrecisionNote(location)`.
- DEV work is required to add and validate structured `location` fields across `lib/types.ts`, providers, booking URL parsing, and tests.
- Until DEV work lands, UI should map legacy `hotel.area` to `Area` and preserve that through the current `/book?area=` parameter.

## Handoff

Create `UI-HOTEL-LOCATION-DECISION-CONTEXT-01` to implement visible location context in hotel cards and hotel handoff review, using legacy `area` as the first supported precision and preparing the UI for structured location fields.
