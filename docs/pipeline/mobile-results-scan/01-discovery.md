# UXD-MOBILE-RESULTS-SCAN-01: Mobile Results Scanning and Card Density

## Problem Statement

On 375px mobile, flight and hotel result cards require too much vertical scrolling to compare prices, Deal Scores, stops, ratings, and provider actions across options, which slows decision-making and weakens confidence that the best deal has been found.

## Affected Users and Flow Step

- **Users affected:** First-time mobile users and returning deal hunters comparing 3+ flight or hotel options, especially users trying to validate whether the cheapest result is also a strong Deal Score.
- **Flow step:** Results review after a flight, hotel, or flight + hotel search returns inventory.
- **Affected source:** `app/page.tsx` renders the results shell, flight/hotel tabs, and hotel grids; `components/flights/FlightResults.tsx` renders flight summary controls and the flight results grid; `app/components/FlightCard.tsx` and `app/components/HotelCard.tsx` define the card density users must scan.

## Current Implementation Signal

- Flight and hotel results use a single-column mobile grid before expanding at larger breakpoints: `FlightResults` renders `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`, and hotel results use the same mobile-first card grid in `app/page.tsx`.
- Flight results include a full summary/control panel before cards: three metric tiles, sort controls, stops filters, result count, live update copy, and optional baggage estimator before the first fare card.
- `FlightCard` prioritizes a full detail card on mobile: airline logo, trip label, route, carrier, stops chip, large price block, Deal Score panel or unavailable panel, full-width CTA, and trust note.
- `HotelCard` is similarly tall on mobile, led by a 192px photo when available, then hotel name, stars/rating, optional Deal Score panel, large nightly price block, CTA, and provider handoff note.
- Existing controls help rank and filter flights, but there is no compact scan mode or denser comparison state for users who want to review more than one option per viewport.

## Measurable Signal

- At 375px, a user should be able to compare at least two returned options' primary decision fields without excessive scrolling: price, route/name, Deal Score verdict or unavailable state, and main constraint such as stops or rating.
- In a first-time user walkthrough, users should identify the cheapest option, best Deal Score option, and whether a nonstop or rated hotel option exists without opening provider handoff links.
- Instrumentable product signal: high scroll depth and repeated up/down scrolling before first provider CTA click on searches with 3+ results.
- UX signal: users report that result review feels like reading full booking cards one at a time rather than scanning a ranked list.

## Constraints

- Preserve trust-critical content: price scope, Deal Score confidence, unavailable states, provider handoff warnings, and affiliate-safe booking links must remain visible or reachable before users leave expaify.
- Preserve performance and provider boundaries: no extra external API calls, no re-fetch required for density changes, and no vendor logic outside `lib/providers`.
- Preserve accessibility at 375px and desktop: keyboard focus, selected states, aria labels, tap targets, and readable text must remain intact in any denser presentation.

## Success Statement

This is solved when a first-time mobile user can scan multiple returned flight or hotel options at 375px, compare the primary price and deal-quality signals, and choose which result deserves deeper review without scrolling through full-height cards one at a time.

## Handoff Notes for UXR

- Audit the exact card heights, information order, and first-viewport content at 375px for both `FlightCard` and `HotelCard`.
- Compare against travel result list patterns that separate quick scanning from expanded details, focusing on interaction structure rather than visual style.
- Validate which fields must remain in the collapsed scan state versus which can move behind expansion or a secondary detail row.
