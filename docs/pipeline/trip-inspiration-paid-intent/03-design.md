# UXDES-TRIP-INSPIRATION-PAID-INTENT-01: Trip Inspiration Paid Intent Design Spec

## Upstream Inputs

- Discovery: `docs/pipeline/trip-inspiration-paid-intent/01-discovery.md`
- Research: `docs/pipeline/trip-inspiration-paid-intent/02-research.md`

## Design Decision

Replace the active homepage `Route suggestions` rail in `app/page.tsx` with one unified `Trip inspiration` area that uses the existing `lib/search/tripInspiration.ts` recommendation shape. The area stays on the active homepage search surface and acts as a prefill entry point into live verification. It must not render alongside the old route-only suggestions as a second unrelated suggestion system.

Selecting an inspiration card must not auto-submit. It must populate a complete search shape and then show a visible ready state above the primary submit button:

`Ready to check live fares and hotels for this trip.`

This preserves user control, avoids implying a checked deal before provider search, and makes the paid-intent handoff explicit.

## User Goal

A paid-intent user with an origin but no fixed destination can select a trip idea, see exactly what search parameters were filled, and proceed to live fare and hotel verification without mistaking static inspiration data for confirmed availability or pricing.

## Information Hierarchy

Primary:

- Search form fields and submit CTA.
- Selected inspiration confirmation state.
- Destination, month, nights, and verification scope on each inspiration card.

Secondary:

- Inspiration label such as `Museum weekend`.
- Destination country.
- Conservative static price hint copy.

Tertiary:

- Theme tag such as `Culture`, `Food`, `Beach`, `City`, `Outdoors`, or `Last minute`.
- Recent-search shortcuts, if retained, must appear below inspiration and use smaller visual weight than inspiration cards.

## Surface Placement

The active homepage keeps the existing two-column desktop composition:

- Left side: brand promise and concise value proposition.
- Right side: search card with intent, trip type, route fields, dates, flexible dates, passengers, and submit.
- Below the search card and above the footer: the unified `Trip inspiration` area.

At 375px mobile, inspiration appears immediately after the submit button so users first see and can use the core search form. At 1280px desktop, inspiration appears below the main search grid, aligned to the same `max-w-7xl` content width.

## Component Contract

Implement as either:

- A new homepage-specific component, for example `TripInspirationHomeRail`, mounted from `app/page.tsx`.
- Or an adapted `TripInspirationRail` that supports selected state, visible copy, and homepage styling.

The implementation must preserve the existing search form state contract in `app/page.tsx`:

- `origin`
- `originDisplay`
- `dest`
- `destDisplay`
- `depart`
- `returnDate`
- `tripType`
- `flexDates`
- `passengers`
- `searchIntent`

No API route, provider, scoring, database, or cache changes are required for this UI design pass.

## Inspiration Data Mapping

For each `TripInspirationItem`:

- `label` renders as the card title, for example `Museum weekend`.
- `destinationCity` and `destinationCountry` render together, for example `Montreal, Canada`.
- `suggestedMonth` renders as a human-readable month, for example `September 2026`.
- `minNights` and `maxNights` render as `3-5 nights`.
- `priceHintUsd` renders only as a qualified hint: `Past low hint: about $260`.
- Verification scope renders as `Checks flights and hotels`.
- `theme` renders as a small tag.

The old homepage `destinations` array should be retired from the primary suggestion area. Do not show metadata such as `Deal history ready`, `Popular route`, or `Frequent fare drops` unless it is backed by a real provider or baseline count.

## Default State

Heading:

`Trip inspiration`

Supporting copy:

`Pick an idea to prefill a live search. Prices are historical hints until you search.`

Card visible strings:

- Theme tag: `Culture`
- Title: `Museum weekend`
- Destination: `Montreal, Canada`
- Date and length: `September 2026 · 3-5 nights`
- Price hint: `Past low hint: about $260`
- Scope: `Checks flights and hotels`
- Card action label, visible on desktop and mobile: `Use this trip`

Empty origin behavior:

- If no origin can be resolved, show fallback ideas using the existing fallback source but label the rail: `Trip inspiration from major hubs`.
- Supporting copy changes to: `Add your origin for more relevant ideas. These are examples that become live searches after you choose dates.`
- Card activation still fills the destination and dates, but must not overwrite an already empty origin with a misleading display. If the fallback origin is required by current data, the selected confirmation must disclose it, for example `Using New York area as the origin for this idea.`

## Selected Ready State

After card activation:

- Populate form state:
  - `origin`: selected item origin or current resolved origin.
  - `originDisplay`: current origin display if it matches the selected origin; otherwise formatted city/IATA where available.
  - `dest`: selected item destination IATA.
  - `destDisplay`: `Destination City (IATA)`.
  - `depart`: first Friday of `suggestedMonth`.
  - `returnDate`: depart plus `minNights`.
  - `tripType`: `roundtrip`.
  - `flexDates`: `true`.
  - `searchIntent`: `trip`.
  - `passengers`: preserve current passenger count.

Show a selected summary between the inspiration area and submit button if the inspiration area remains inside the form, or directly below the rail if the rail remains below the form.

Selected summary copy:

`Ready to check live fares and hotels for this trip.`

Selected details:

`New York (JFK) to Montreal (YUL) · Sep 4-7, 2026 · Flexible dates · 1 traveler`

Secondary disclosure:

`The price hint is historical. expaify checks current fares, hotels, and Deal Score after you search.`

Selected card state:

- `aria-pressed="true"`.
- Card border uses `var(--brand)`.
- Card background uses `var(--brand-soft)`.
- A small selected label reads `Selected`.

## Loading State

There is no separate loading state for rendering static inspiration because `getTripInspiration` is synchronous today. The loading state applies after the user submits the prefilled search.

While the existing search is running:

- Preserve the selected summary above the disabled submit button.
- Submit label uses existing intent-aware copy: `Checking flights and hotels...`
- Do not replace the inspiration cards with skeletons unless a future server-generated recommendation source is added.

If future inspiration loading is added, render three cards with fixed dimensions and `aria-hidden="true"` skeleton blocks, plus a polite status:

`Loading trip ideas...`

## Empty State

Empty recommendation state should only appear if the inspiration source returns an empty array.

Heading remains:

`Trip inspiration`

Empty copy:

`No trip ideas are available for this origin yet. Enter a destination or search anywhere to check live options.`

Required UI:

- No blank rail.
- No disabled fake cards.
- Keep the main search form usable.
- Keep recent searches, if present, below this empty message.

## Error State

Inspiration should not block the homepage if local recommendation generation fails.

Error copy:

`Trip ideas are unavailable right now. You can still search live fares and hotels.`

Required UI:

- Use `role="status"` for non-blocking inspiration errors.
- Do not use `role="alert"` unless the error prevents form submission.
- Do not clear user-entered search fields.
- Do not disable the primary search CTA.

## Mobile Spec: 375px

Layout:

- Search card remains first and full width.
- Inspiration appears after the search CTA with `mt-5`.
- Rail is horizontally scrollable with snap points.
- Each card width: `w-[17rem] max-w-[calc(100vw-2rem)]`.
- Card min height: `min-h-[10.5rem]`.
- Card internal spacing: `p-4`.
- The card action label must be visible without hover.
- The selected summary must wrap naturally and must not overlap the submit button.

Mobile ordering inside card:

1. Theme tag and selected label row.
2. `label`.
3. `destinationCity, destinationCountry`.
4. `suggestedMonth · min-max nights`.
5. `Past low hint: about $X`.
6. `Checks flights and hotels`.
7. `Use this trip`.

Mobile ergonomics:

- Card tap target is the whole card, minimum `44px` in both dimensions.
- Horizontal scroll area has `pb-2` so focus rings are not clipped.
- Do not hide all cards behind a carousel control.
- Do not use hover-only affordances.

## Desktop Spec: 1280px

Layout:

- Inspiration area aligns to `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`.
- Header row has heading left and disclosure right.
- Cards render in a responsive grid when space allows: `lg:grid lg:grid-cols-4`.
- If more than four items exist, overflow can become horizontal, but the first four must be visible at 1280px.
- Card min height: `min-h-[11rem]`.

Desktop disclosure text:

`Live fares checked after search.`

Desktop card action:

`Use this trip`

Recent searches:

- If retained, move below inspiration under heading `Recent searches`.
- Recent-search pills remain route-only and must not share the same visual weight as trip inspiration cards.

## Focus And Keyboard

Tab order:

1. Search intent segmented controls.
2. Trip type controls.
3. Origin.
4. Swap.
5. Destination.
6. Dates.
7. Flexible dates.
8. Passenger controls.
9. Submit.
10. Inspiration cards.
11. Recent searches, if present.

If implementation places inspiration above submit inside the form, then tab order may place cards before submit, but the selected ready summary must appear before the submit button.

Keyboard activation:

- Cards are real `button type="button"` elements.
- Enter and Space activate the card.
- Activation moves focus to the selected summary if it is inserted before the submit button; otherwise focus remains on the selected card and the ready summary is announced with `aria-live="polite"`.

Accessible names:

Each card name must include destination, month, night range, action, verification scope, and price-basis disclosure if a price is shown.

Example:

`Use Museum weekend trip to Montreal, Canada in September 2026 for 3 to 5 nights. Past low hint about 260 dollars, not a live fare. Checks flights and hotels after search.`

Focus styling:

- Use existing global `:focus-visible` behavior.
- Do not remove outlines.
- Ensure scroll containers have enough padding so focus rings are visible.

## Interaction Rules

On card hover:

- Slight border emphasis only.
- Do not animate layout, resize cards, or reveal essential text only on hover.

On card activation:

- Set form fields as described in Selected Ready State.
- Clear route/date form errors only if the new selected values satisfy date validation.
- Set `searchIntent` to `trip`.
- Set `tripType` to `roundtrip`.
- Set `flexDates` to `true`.
- Preserve passenger count.
- Do not submit automatically.
- Show or update selected ready summary.

On submit after selection:

- Use the existing `/api/search` path through current `handleSearch`.
- Results should open using the existing results view.
- Existing loading, empty, provider notice, and error behavior remain unchanged.

On user manually edits a selected field:

- Keep the selected summary only if route and date values still match the selected inspiration item.
- If the user changes origin, destination, depart, return, trip type, or search intent, remove `Selected` state and replace the summary with no message.
- Do not clear passenger changes.

On validation error:

- Keep the selected card state if the selected data is still present.
- Show existing field-level date or form errors.
- Do not claim live verification has started.

## Final UI Copy

Rail heading:

`Trip inspiration`

Rail supporting copy:

`Pick an idea to prefill a live search. Prices are historical hints until you search.`

Rail disclosure:

`Live fares checked after search.`

Card action:

`Use this trip`

Selected label:

`Selected`

Selected confirmation:

`Ready to check live fares and hotels for this trip.`

Selected disclosure:

`The price hint is historical. expaify checks current fares, hotels, and Deal Score after you search.`

Empty:

`No trip ideas are available for this origin yet. Enter a destination or search anywhere to check live options.`

Error:

`Trip ideas are unavailable right now. You can still search live fares and hotels.`

Fallback-origin note:

`Add your origin for more relevant ideas.`

Disallowed copy:

- `From $260`
- `Deal found`
- `Best deal`
- `Verified fare`
- `Deal history ready`
- `Frequent fare drops`
- `Popular route`

## Tailwind Class Patterns

Use existing tokens from `app/globals.css` through Tailwind arbitrary values. Do not introduce new colors.

Section:

```tsx
<section
  id="trip-inspiration"
  aria-labelledby="trip-inspiration-heading"
  className="mx-auto w-full max-w-7xl px-4 pb-7 sm:px-6 lg:px-8"
>
```

Header:

```tsx
<div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h2 id="trip-inspiration-heading" className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--text-3)]">
      Trip inspiration
    </h2>
    <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[var(--text-2)]">
      Pick an idea to prefill a live search. Prices are historical hints until you search.
    </p>
  </div>
  <p className="text-xs font-semibold text-[var(--text-3)]">Live fares checked after search.</p>
</div>
```

Rail or grid:

```tsx
<div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-4 lg:overflow-visible">
```

Default card:

```tsx
className="flex min-h-[10.5rem] w-[17rem] max-w-[calc(100vw-2rem)] shrink-0 snap-start flex-col items-start justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-hover)] focus-visible:outline-none lg:w-auto lg:min-h-[11rem]"
```

Selected card:

```tsx
className="border-[var(--brand)] bg-[var(--brand-soft)] shadow-[var(--shadow-lift)]"
```

Tag:

```tsx
className="rounded-full bg-[var(--bg-muted)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]"
```

Selected label:

```tsx
className="rounded-full bg-[var(--brand)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-inverse)]"
```

Card title:

```tsx
className="font-display text-base font-extrabold leading-tight text-[var(--text-1)]"
```

Card metadata:

```tsx
className="text-xs font-semibold leading-5 text-[var(--text-2)]"
```

Price hint:

```tsx
className="text-xs font-bold leading-5 text-[var(--warning)]"
```

Ready summary:

```tsx
className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-2)]"
```

Ready summary title:

```tsx
className="font-bold text-[var(--text-1)]"
```

Error/empty panel:

```tsx
className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium leading-6 text-[var(--text-2)]"
```

## Edge Cases

- One-way mode selected before activation: card activation switches to round trip because inspiration includes a return date.
- Hotels-only mode selected before activation: card activation switches to `trip` because directive requires fare and hotel verification entry.
- Destination already typed: card activation replaces destination after explicit user click.
- Past generated date: if `firstFridayOfMonth(suggestedMonth)` is earlier than `todayIso()`, use the next valid Friday in that month; if no future Friday remains, use the first Friday of the next month.
- `maxNights` differs from selected return: selected search uses `minNights` for the actual return date and displays the range as discovery context.
- Origin city alias such as JFK -> NYC: visible origin should remain user-recognizable, for example `New York (JFK)`, unless the data source requires city-level `NYC`; in that case the summary can say `New York area`.
- Long destination names must wrap inside cards and never truncate the country if the city is visible.
- Static price hint missing: omit the price row entirely and keep the accessible name free of price language.

## QA Acceptance Criteria

1. At 375px, the search form and inspiration area have no overlapping text, hidden primary actions, or clipped focus rings.
2. At 1280px, users see one primary inspiration area, not both `Route suggestions` and `Trip ideas`.
3. Selecting a card populates origin, destination, departure date, return date, round trip, flexible dates, and `Flight + hotel`.
4. Selecting a card shows `Ready to check live fares and hotels for this trip.`
5. No card uses bare `From $X` or implies a confirmed fare.
6. Cards are reachable by keyboard and activatable with Enter and Space.
7. Screen-reader labels include the non-live price disclosure when a price hint is shown.
8. Search still runs through the existing submit flow and provider-backed search path.
9. Existing results, booking/deeplink, and recent-search flows are not regressed.

## Implementation Handoff

Next ticket: `UI-TRIP-INSPIRATION-PAID-INTENT-01`

Scope for UI:

- Update `app/page.tsx` homepage UI only.
- Replace the route suggestions rail with unified trip inspiration.
- Reuse `getTripInspiration` and existing date helper behavior where possible.
- Add selected state and ready summary.
- Update static price copy and accessible names.
- Preserve existing search API and results behavior.

No DEV ticket is needed unless implementation discovers that recommendation freshness, provider-backed pricing metadata, or server-generated inspiration is required.
