# AUDIT-RESULTS-DETAIL-PANEL-MOBILE-FIT-01

Date: 2026-06-30
Auditor: Senior QA
Scope: Results detail panel mobile fit, dismissal, focus, and content readability.

## Verdict

Blocked for acceptance. The current results UI does not expose a flight or hotel detail panel, expanded state, modal, slideover, backdrop, close button, Escape handling, or return-focus behavior for search results. Result facts are embedded directly in `FlightCard` and `HotelCard`.

Because there is no detail panel to open or close, the required manual flow of opening and closing details from search results cannot be completed against the current implementation.

## Findings

### P1 - No result detail panel or expanded state exists to open, dismiss, or return focus from

Files:
- `components/flights/FlightResults.tsx:324`
- `app/components/FlightCard.tsx:270`
- `app/components/HotelCard.tsx:187`

Evidence:
- Flight results render `FlightCard` instances directly in a responsive grid.
- Flight itinerary, price, Deal Score, and provider CTA are always visible inside the card.
- Hotel details are always visible inside `HotelCard`.
- Repo search found no result-level `dialog`, `aria-modal`, `Escape`, `backdrop`, `expanded`, or detail-panel state in `app/` or `components/`.

Impact:
- Required behaviors cannot be verified: focus entry, Escape dismissal, backdrop click, scroll containment, and return focus.
- Paid-user trust risk remains unknown for any future panel because no interaction contract exists today.

Repro:
1. Inspect `components/flights/FlightResults.tsx`.
2. Confirm results map directly to `FlightCard` at line 324.
3. Inspect `FlightCard` and `HotelCard`.
4. Confirm no opener, close control, dialog role, or dismissal logic.

### P2 - Flight card can only show limited Deal Score evidence in the embedded detail surface

Files:
- `app/components/FlightCard.tsx:164`
- `app/components/FlightCard.tsx:181`
- `app/components/FlightCard.tsx:192`

Evidence:
- The flight score panel shows verdict via `DealBadge`, percentile text, and explanation.
- It does not show median price or percent versus median, unlike the hotel score panel.

Impact:
- The ticket asks to verify score evidence and price context remains readable. For flights, key score evidence is not present in the current embedded detail surface, so readability cannot be validated for missing fields.
- This is an out-of-scope content gap for this ticket, not a requested implementation change.

### P2 - Mobile 375px route timeline has tight fixed columns with center label overlay risk

File:
- `app/components/FlightCard.tsx:299`
- `app/components/FlightCard.tsx:301`
- `app/components/FlightCard.tsx:318`
- `app/components/FlightCard.tsx:325`

Evidence:
- The itinerary row uses fixed `w-[4.75rem]` left and right columns plus a flexible center line and absolutely positioned `Return` / `Route` label.
- At 375px, the card has horizontal padding plus a fixed-width itinerary layout. With large local times, longer airport labels, zoomed text, or translated copy, the center badge has limited room before it visually crowds the endpoint columns.

Impact:
- Risk of cramped itinerary facts on mobile. I did not mark this as confirmed clipping because live browser verification was blocked in this environment.

### P3 - Hotel score panel has better evidence hierarchy than flight score panel but uses compact two-column evidence at mobile width

Files:
- `app/components/HotelCard.tsx:135`
- `app/components/HotelCard.tsx:147`
- `app/components/HotelCard.tsx:166`

Evidence:
- Hotel score includes percentile, badge, usual price, percent versus median, low-confidence warning, and explanation.
- The evidence grid is two columns even on mobile.

Impact:
- Readable in code structure, but dense on 375px for long localized currency values or large text settings. Needs browser verification before signoff.

## State Coverage

Covered by code inspection:
- Loading: flight skeletons in `components/flights/FlightResults.tsx:289`; hotel skeletons in `app/page.tsx:1436`.
- Empty: flight empty panel in `components/flights/FlightResults.tsx:310`; hotel empty panel in `app/page.tsx:1448`.
- Error: search error panel in `app/page.tsx:1328`.
- Desktop layout: results grid moves to `sm:grid-cols-2` and `lg:grid-cols-3`, with CTAs inside each card.
- Primary actions: flight CTA at `app/components/FlightCard.tsx:352`; hotel CTA at `app/components/HotelCard.tsx:254`.

Not verified live:
- 375px browser scrolling and visual clipping.
- Desktop rendered visual spacing.
- Keyboard focus traversal in browser.
- Detail-panel open/close flow, because no such flow exists.

## Manual Verification Attempt

Attempted to start the local app:

```text
npm run dev -- --hostname 127.0.0.1 --port 3021
```

Result:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:3021
```

Manual browser verification could not be completed because the sandbox does not permit binding the dev server. Playwright and Puppeteer are not installed in the repo, so no existing browser automation fallback was available.

## Out Of Scope

- No implementation changes made.
- No modal/panel redesign proposed.
- No provider data shape changes.
- No booking or affiliate handoff changes.
- Missing flight median and percent-vs-median display is recorded as an evidence gap, not fixed here.

## Acceptance Status

Failing / blocked:
- Open and close details from search results.
- Mobile 375px live scrolling verification.
- Focus entry, Escape dismissal, backdrop behavior, and return focus.

Passing by code inspection only:
- Empty, loading, and error states exist.
- Embedded flight and hotel cards include provider, itinerary/location, price, Deal Score, and primary action surfaces.
- No decorative clutter was found in the result detail surfaces themselves.
