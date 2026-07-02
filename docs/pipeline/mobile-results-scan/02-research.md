# UXR-MOBILE-RESULTS-SCAN-01: Mobile Results Scanning and Card Density

## Source Inputs

- Discovery: `docs/pipeline/mobile-results-scan/01-discovery.md`
- Current surfaces audited:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/components/FlightCard.tsx`
  - `app/components/HotelCard.tsx`
  - `app/globals.css`

## Research Summary

At 375px, expaify presents mobile results as full booking-detail cards rather than a scan-first ranked list. A user can sort and filter flights, but the first mobile viewport is dominated by summary controls before the first fare, and each result card spends vertical space on secondary trust copy, large price typography, full Deal Score explanation panels, full-width CTAs, and hotel imagery. This makes comparison across three or more options feel sequential instead of scannable.

The UX gap is not missing information. The gap is hierarchy. Price, Deal Score, stops or rating, and provider action all exist, but they are arranged as stacked detail sections inside every card instead of a compact comparison row with optional expansion for trust-heavy details.

## Current Implementation Audit

### Results Shell

`app/page.tsx` renders a sticky result header, result summary, share button, tabs, then delegates flight results to `FlightResults` and renders hotel cards directly. The tab area and hotel grids are mobile-first single-column layouts:

- Flight surface handoff: `app/page.tsx` passes state into `FlightResults` at lines 1449-1475.
- Hotel loading and result grids use `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` at lines 1481 and 1516.
- At 375px, the result shell adds top-level vertical cost before cards: result summary, share button, tab row, optional hotel unavailable notice, then the active result content.

### Flight Results

`components/flights/FlightResults.tsx` adds a high-value but tall controls panel before cards:

- Three metric tiles render before controls: lowest live fare, great deals, nonstop options at lines 231-267.
- Sort and stops controls render as two rows of 44px minimum buttons at lines 268-311.
- A live summary row and ranking update copy render at lines 317-325.
- Optional baggage fee estimator renders before the result grid at lines 329-335.
- Flight cards render in a single mobile column at lines 373-383.

This means the first fare is pushed below a summary/control block even when the user's immediate task is to compare returned options.

### Flight Card

`app/components/FlightCard.tsx` presents each mobile fare as a full detail object:

- Price uses `text-4xl` and includes heading plus scope copy at lines 112-123.
- Header, airline logo, route, carrier, and stops are stacked with price at lines 275-300.
- Deal Score is always a dedicated panel or unavailable panel at lines 302-308.
- Provider action is always a full-width 48px control plus trust note at lines 310-337.
- The full card uses `space-y-5 p-5`, so every result reserves large vertical gaps even when the user only needs comparison fields.

The code computes but does not display departure or return times: `departTime` and `returnTime` are assigned at lines 242-243 and unused. That means the card consumes detail-card space without surfacing a useful itinerary scan signal.

### Hotel Card

`app/components/HotelCard.tsx` is even taller on mobile:

- Hotel photo uses `h-48` when present at lines 191-200; no-photo state still reserves `h-24` at lines 201-204.
- Name, stars, and numeric rating render above score at lines 207-221.
- Deal Score panel includes percentile, badge, usual price, vs median, low-confidence copy, and explanation at lines 118-168.
- Price and CTA render after a border-top block at lines 232-270.

`RatingBadge` exists at lines 31-49 but is not used. The rendered card shows a bare numeric rating next to stars, which is less scannable than the defined rating badge pattern.

## Reference Pattern Comparison

### Booking.com Style Hotel Results

Common hotel result-list patterns separate scan content from detail content. The collapsed row prioritizes photo thumbnail, hotel name, rating/review signal, price, and primary CTA. Amenities, policies, explanation copy, and longer trust notes are secondary and often revealed lower in the card or after expansion. The user can compare several hotels by scanning the same fields in the same positions.

Delta for expaify: the hotel card has the required signals, but the 192px photo and full Deal Score explanation make each result act like an expanded detail card by default. The CTA and price appear after the score panel, so mobile users cannot compare names, ratings, Deal Scores, and prices for multiple hotels without scrolling through repeated explanations.

### Google Flights Style Flight Results

Common flight result-list patterns use compact itinerary rows. The default row aligns time/route, duration or stops, price, and quality or ranking cues. Details, provider rules, baggage, and caveats are available after selecting or expanding a row. Sorting and filters remain accessible, but they do not obscure the ranked list.

Delta for expaify: flight cards prioritize trust copy and Deal Score explanation inside every result. The current mobile surface supports sorting and filtering, but it does not offer a compact row where price, Deal Score verdict, stops, and route are visible in a repeatable structure across multiple fares.

## Exact Gap

Current code does this:

- Uses one mobile column for both flight and hotel results.
- Treats every result as fully expanded.
- Shows long Deal Score explanation or unavailable copy for every flight card.
- Shows large hotel imagery before price and CTA.
- Places flight controls and optional baggage estimator above the list.
- Preserves trust copy, but repeats it in a way that slows comparison.

Reference patterns do this:

- Present a dense collapsed row/card for scanning.
- Keep primary fields in fixed positions across results.
- Defer secondary explanation, provider handoff notes, and deeper context until expansion or selected state.
- Keep filters available while preserving fast access to the ranked list.

The delta:

- expaify needs a mobile-first collapsed result state for both flights and hotels, plus an expansion/details state for trust-critical information.

## Design Directives for UXDES

1. Define a collapsed mobile result row for flights that fits the primary scan fields into one compact card: route, carrier, stops, price, Deal Score verdict or "Score pending/unavailable", and one provider action affordance. Move full Deal Score explanation, price-scope sentence, provider handoff note, and baggage context into an expanded details region.

2. Define a collapsed mobile result row for hotels that uses a thumbnail no taller than 72px, hotel name, star/rating signal, nightly price, Deal Score verdict or unavailable state, and one provider action affordance. Move the full photo treatment, usual price, vs median, explanation, and provider handoff note into expanded details.

3. Add one explicit details interaction per result. The collapsed card must expose a keyboard-focusable control with copy such as "Details" or "Hide details", `aria-expanded`, and a stable expanded region containing the long trust copy. The primary CTA must remain reachable without requiring expansion when the price and link are valid.

4. Preserve a compact trust signal in collapsed state. Low-confidence Deal Scores must not show "Great"; collapsed copy should use "Limited history" when confidence is low. Score-unavailable state must remain visible as "Score unavailable" or "Score pending" rather than disappearing.

5. Reduce pre-list vertical cost on mobile. The flight summary/control panel should collapse to a compact toolbar or two-line summary at 375px: result count, active sort, active stops filter, and a filter/sort control. The three metric tiles and baggage estimator should not sit above the first result on 375px unless expanded or moved below the first result set.

## Acceptance Checks for Next Stage

- At 375px, at least two collapsed flight results can be partially or fully compared in the viewport after the result tabs without opening provider links.
- At 375px, at least two collapsed hotel results can be partially or fully compared in the viewport when photos are present.
- Every collapsed result exposes price, Deal Score verdict or unavailable state, and the main constraint signal: stops for flights, rating or stars for hotels.
- Expanding a result exposes the current trust-critical copy: score explanation, low-confidence language, price scope, provider handoff note, unavailable reasons, and booking-link state.
- Keyboard users can tab through tabs, sort/filter controls, each result details toggle, and each valid provider action without losing visible focus.
- Desktop layouts may keep existing spacious cards, but mobile must not rely on desktop-only grid density.

## Out-of-Scope Findings

- `app/components/__tests__/scorePresentation.test.tsx` appears stale for hotels. It expects "Hotel class" and "Guest rating", but `HotelCard` currently renders stars and a bare numeric rating without those labels.
- `RatingBadge` in `app/components/HotelCard.tsx` is unused. This may be useful for the compact hotel scan state, but changing it belongs to the UI stage.
- `departTime` and `returnTime` in `app/components/FlightCard.tsx` are computed and unused. The UI stage should decide whether itinerary times belong in the collapsed flight row.
